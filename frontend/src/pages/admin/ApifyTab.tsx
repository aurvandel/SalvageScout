import { useEffect, useState } from 'react'
import { fetchSettings, updateApifySettings } from '../../api/client'
import type { ApifySettingsOut } from '../../api/types'

export default function ApifyTab() {
  const [apify, setApify] = useState<ApifySettingsOut | null>(null)
  const [actorId, setActorId] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchSettings()
      setApify(data.apify)
      setActorId(data.apify.actor_id)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Apify settings')
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError(null)
      const fields: Record<string, string> = { actor_id: actorId }
      if (token) fields.apify_token = token

      const updated = await updateApifySettings(fields)
      setApify(updated.apify)
      setToken('')
      alert('Apify settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Apify settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!apify) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  return (
    <div className="admin-section">
      <h2>Apify Scraper</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="actor-id">Actor ID</label>
          <input
            id="actor-id"
            type="text"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
          />
          <p className="help-text">The Apify actor used to scrape Facebook Marketplace listings.</p>
        </div>

        <div className="config-item">
          <label htmlFor="apify-token">
            Apify API Token {apify.apify_token_masked && <span className="masked-value">({apify.apify_token_masked})</span>}
          </label>
          <input
            id="apify-token"
            type="password"
            placeholder={apify.apify_token_masked ? 'Unchanged' : 'Not set'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <button className="save-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Apify Settings'}
        </button>
      </div>
    </div>
  )
}
