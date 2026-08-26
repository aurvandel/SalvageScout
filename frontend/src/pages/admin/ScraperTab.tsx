import { useEffect, useState } from 'react'
import { fetchSettings, updateScraperSettings } from '../../api/client'
import type { ScraperSettingsOut } from '../../api/types'

const PROVIDER_LABELS: Record<string, string> = {
  apify: 'Apify',
  scrape_creators: 'ScrapeCreators',
}

export default function ScraperTab() {
  const [scraper, setScraper] = useState<ScraperSettingsOut | null>(null)
  const [provider, setProvider] = useState('')
  const [enrichmentEnabled, setEnrichmentEnabled] = useState(false)
  const [keys, setKeys] = useState({ bright_data_api_key: '', scrape_creators_api_key: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchSettings()
      setScraper(data.scraper)
      setProvider(data.scraper.provider)
      setEnrichmentEnabled(data.scraper.bright_data_enrichment_enabled)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scraper settings')
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError(null)
      const fields: Record<string, string | boolean> = { provider, bright_data_enrichment_enabled: enrichmentEnabled }
      if (keys.bright_data_api_key) fields.bright_data_api_key = keys.bright_data_api_key
      if (keys.scrape_creators_api_key) fields.scrape_creators_api_key = keys.scrape_creators_api_key

      const updated = await updateScraperSettings(fields)
      setScraper(updated.scraper)
      setKeys({ bright_data_api_key: '', scrape_creators_api_key: '' })
      alert('Scraper settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scraper settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!scraper) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  return (
    <div className="admin-section">
      <h2>Scraper Backend</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="scraper-provider">Active Provider</label>
          <select id="scraper-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {scraper.available_providers.map(p => (
              <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
            ))}
          </select>
          <p className="help-text">Finds listings matching a filter's location, price range, and query.</p>
        </div>

        {provider !== 'apify' && scraper.incompatible_filter_names.length > 0 && (
          <div className="error-message">
            These search filters use a pasted Facebook URL, which only Apify can scrape, and won't
            run under {PROVIDER_LABELS[provider] || provider}: {scraper.incompatible_filter_names.join(', ')}
          </div>
        )}

        <h3>ScrapeCreators</h3>
        <div className="config-item">
          <label htmlFor="scrape-creators-key">
            ScrapeCreators API Key {scraper.scrape_creators_api_key_masked && <span className="masked-value">({scraper.scrape_creators_api_key_masked})</span>}
          </label>
          <input
            id="scrape-creators-key"
            type="password"
            placeholder={scraper.scrape_creators_api_key_masked ? 'Unchanged' : 'Not set'}
            value={keys.scrape_creators_api_key}
            onChange={(e) => setKeys(prev => ({ ...prev, scrape_creators_api_key: e.target.value }))}
          />
        </div>

        <h3>Bright Data Detail Enrichment</h3>
        <p className="help-text">
          Bright Data's Facebook Marketplace scraper can't search or discover listings — it only
          fetches full detail for a listing URL you already have. It can't replace the active
          provider above, but can optionally re-fetch richer detail for each listing that provider
          finds. Uses Bright Data's Web Scraper API (5K free records/month, then $1.5/1K) — not the
          paid Datasets marketplace. No dataset ID to configure; it's a fixed, shared scraper.
        </p>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={enrichmentEnabled}
              onChange={(e) => setEnrichmentEnabled(e.target.checked)}
            />
            Enable detail enrichment
          </label>
        </div>
        <div className="config-item">
          <label htmlFor="bright-data-key">
            Bright Data API Key {scraper.bright_data_api_key_masked && <span className="masked-value">({scraper.bright_data_api_key_masked})</span>}
          </label>
          <input
            id="bright-data-key"
            type="password"
            placeholder={scraper.bright_data_api_key_masked ? 'Unchanged' : 'Not set'}
            value={keys.bright_data_api_key}
            onChange={(e) => setKeys(prev => ({ ...prev, bright_data_api_key: e.target.value }))}
          />
        </div>

        <button className="save-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Scraper Settings'}
        </button>
      </div>
    </div>
  )
}
