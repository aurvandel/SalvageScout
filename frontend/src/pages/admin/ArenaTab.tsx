import { useEffect, useState } from 'react'
import { fetchListings, fetchCriteriaProfiles, fetchSettings, runArenaTest } from '../../api/client'
import type { ListingOut, CriteriaProfileOut, LLMSettingsOut, ArenaRunOut } from '../../api/types'

export default function ArenaTab() {
  const [listings, setListings] = useState<ListingOut[]>([])
  const [profiles, setProfiles] = useState<CriteriaProfileOut[]>([])
  const [llm, setLLM] = useState<LLMSettingsOut | null>(null)

  const [listingId, setListingId] = useState<number | null>(null)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Record<string, { included: boolean; model: string }>>({})

  const [results, setResults] = useState<ArenaRunOut | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [listingPage, profileList, settings] = await Promise.all([
        fetchListings({ limit: 50 }),
        fetchCriteriaProfiles(),
        fetchSettings(),
      ])
      setListings(listingPage.items)
      setProfiles(profileList)
      setLLM(settings.llm)

      const activeProfile = profileList.find(p => p.is_active)
      setProfileId(activeProfile?.id ?? profileList[0]?.id ?? null)
      setListingId(listingPage.items[0]?.id ?? null)

      const initialSelected: Record<string, { included: boolean; model: string }> = {}
      for (const provider of settings.llm.available_providers) {
        initialSelected[provider] = {
          included: true,
          model: settings.llm.provider_models[provider]?.[0] || '',
        }
      }
      setSelected(initialSelected)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load arena setup data')
    }
  }

  function toggleProvider(provider: string) {
    setSelected(prev => ({ ...prev, [provider]: { ...prev[provider], included: !prev[provider].included } }))
  }

  function setProviderModel(provider: string, model: string) {
    setSelected(prev => ({ ...prev, [provider]: { ...prev[provider], model } }))
  }

  async function handleRun() {
    if (listingId == null || profileId == null) {
      setError('Select a listing and a criteria profile first')
      return
    }

    const providers = Object.entries(selected).filter(([, v]) => v.included).map(([p]) => p)
    const models = providers.map(p => selected[p].model)

    if (providers.length === 0) {
      setError('Select at least one provider to compare')
      return
    }

    try {
      setIsRunning(true)
      setError(null)
      const run = await runArenaTest({ listing_id: listingId, criteria_profile_id: profileId, providers, models })
      setResults(run)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run arena test')
    } finally {
      setIsRunning(false)
    }
  }

  if (!llm) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  return (
    <div className="admin-section">
      <h2>Arena Mode — LLM Comparison</h2>
      <p className="help-text">Score one listing with multiple providers/models side-by-side to compare quality.</p>

      {error && <div className="error-message">{error}</div>}

      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="arena-listing">Listing</label>
          <select id="arena-listing" value={listingId ?? ''} onChange={(e) => setListingId(Number(e.target.value))}>
            {listings.map(l => (
              <option key={l.id} value={l.id}>{l.title} — ${l.price_amount ?? '?'}</option>
            ))}
          </select>
        </div>

        <div className="config-item">
          <label htmlFor="arena-profile">Criteria Profile</label>
          <select id="arena-profile" value={profileId ?? ''} onChange={(e) => setProfileId(Number(e.target.value))}>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>

        <h3>Providers to Compare</h3>
        {llm.available_providers.map(provider => (
          <div key={provider} className="arena-provider-row">
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={selected[provider]?.included ?? false}
                onChange={() => toggleProvider(provider)}
              />
              {provider}
            </label>
            <select
              value={selected[provider]?.model || ''}
              onChange={(e) => setProviderModel(provider, e.target.value)}
              disabled={!selected[provider]?.included}
            >
              {(llm.provider_models[provider] || []).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        ))}

        <button className="run-button" onClick={handleRun} disabled={isRunning}>
          {isRunning ? 'Running Arena Test...' : 'Run Arena Test'}
        </button>
      </div>

      {results && (
        <div className="arena-results">
          <h3>Arena Test Results</h3>
          <div className="arena-comparison">
            {results.results.map((result) => (
              <div key={`${result.provider}-${result.model}`} className="arena-card">
                <div className="card-header">
                  <strong>{result.provider} / {result.model}</strong>
                  <span className="score-badge">{result.match_score}/100</span>
                </div>
                <div className="card-body">
                  <p className="summary">{result.summary}</p>
                  <div className="lists">
                    <div className="list-section">
                      <strong>Pros:</strong>
                      <ul>{result.pros.map((pro, i) => <li key={i}>{pro}</li>)}</ul>
                    </div>
                    <div className="list-section">
                      <strong>Cons:</strong>
                      <ul>{result.cons.map((con, i) => <li key={i}>{con}</li>)}</ul>
                    </div>
                    {result.dealbreaker_flags.length > 0 && (
                      <div className="list-section">
                        <strong>Dealbreakers:</strong>
                        <ul>{result.dealbreaker_flags.map((flag, i) => <li key={i}>{flag}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
