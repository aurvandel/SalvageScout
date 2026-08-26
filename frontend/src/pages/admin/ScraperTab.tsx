import { useEffect, useState } from 'react'
import { fetchSettings, updateScraperSettings } from '../../api/client'
import type { ScraperSettingsOut } from '../../api/types'

const PROVIDER_LABELS: Record<string, string> = {
  apify: 'Apify',
  bright_data: 'Bright Data',
  scrape_creators: 'ScrapeCreators',
}

export default function ScraperTab() {
  const [scraper, setScraper] = useState<ScraperSettingsOut | null>(null)
  const [provider, setProvider] = useState('')
  const [datasetId, setDatasetId] = useState('')
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
      setDatasetId(data.scraper.bright_data_dataset_id || '')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scraper settings')
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError(null)
      const fields: Record<string, string> = { provider, bright_data_dataset_id: datasetId }
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
        </div>

        {provider !== 'apify' && scraper.incompatible_filter_names.length > 0 && (
          <div className="error-message">
            These search filters use a pasted Facebook URL, which only Apify can scrape, and won't
            run under {PROVIDER_LABELS[provider] || provider}: {scraper.incompatible_filter_names.join(', ')}
          </div>
        )}

        <h3>Bright Data</h3>
        <p className="help-text">
          Unverified: the request/response shape below is based on secondhand documentation, not a
          live call against a real dataset. Confirm it works before relying on it for real runs.
        </p>
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
        <div className="config-item">
          <label htmlFor="bright-data-dataset-id">Bright Data Dataset ID</label>
          <input
            id="bright-data-dataset-id"
            type="text"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
          />
          <p className="help-text">Found on the Facebook Marketplace scraper's page in the Bright Data dashboard.</p>
        </div>

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

        <button className="save-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Scraper Settings'}
        </button>
      </div>
    </div>
  )
}
