import { useEffect, useState } from 'react'
import { fetchSearchFilters, createSearchFilter, updateSearchFilter, deleteSearchFilter, fetchCriteriaProfiles } from '../../api/client'
import type { SearchFilterOut, CriteriaProfileOut } from '../../api/types'

const emptyForm = {
  name: '',
  is_active: true,
  search_mode: 'url' as 'url' | 'location',
  search_url: '',
  location: '',
  query: '',
  min_price: '',
  max_price: '',
  radius_miles: '',
  days_listed: '',
  condition: '',
  results_limit: '100',
  criteria_profile_id: '' as number | '',
}

export default function SearchFiltersTab() {
  const [filters, setFilters] = useState<SearchFilterOut[]>([])
  const [profiles, setProfiles] = useState<CriteriaProfileOut[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
    fetchCriteriaProfiles()
      .then(data => setProfiles(data.sort((a, b) => b.version - a.version)))
      .catch(() => {})
  }, [])

  async function load() {
    try {
      const data = await fetchSearchFilters()
      setFilters(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load search filters')
    }
  }

  function profileLabel(id: number | null): string {
    if (id == null) return 'Default active prompt'
    const profile = profiles.find(p => p.id === id)
    return profile ? `${profile.name} (v${profile.version})` : `Prompt #${id}`
  }

  function startEdit(sf: SearchFilterOut) {
    setEditingId(sf.id)
    setForm({
      name: sf.name,
      is_active: sf.is_active,
      search_mode: sf.search_mode,
      search_url: sf.search_url || '',
      location: sf.location || '',
      query: sf.query || '',
      min_price: sf.min_price?.toString() || '',
      max_price: sf.max_price?.toString() || '',
      radius_miles: sf.radius_miles?.toString() || '',
      days_listed: sf.days_listed?.toString() || '',
      condition: sf.condition || '',
      results_limit: sf.results_limit?.toString() || '100',
      criteria_profile_id: sf.criteria_profile_id ?? '',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function buildPayload() {
    return {
      name: form.name,
      is_active: form.is_active,
      search_mode: form.search_mode,
      search_url: form.search_mode === 'url' ? form.search_url : null,
      location: form.search_mode === 'location' ? form.location : null,
      query: form.search_mode === 'location' && form.query ? form.query : null,
      min_price: form.search_mode === 'location' && form.min_price ? parseInt(form.min_price) : null,
      max_price: form.search_mode === 'location' && form.max_price ? parseInt(form.max_price) : null,
      radius_miles: form.search_mode === 'location' && form.radius_miles ? parseInt(form.radius_miles) : null,
      days_listed: form.search_mode === 'location' && form.days_listed ? parseInt(form.days_listed) : null,
      condition: form.search_mode === 'location' && form.condition ? form.condition : null,
      results_limit: parseInt(form.results_limit) || 100,
      criteria_profile_id: form.criteria_profile_id === '' ? null : form.criteria_profile_id,
    }
  }

  async function handleSubmit() {
    try {
      setIsSaving(true)
      setError(null)
      const payload = buildPayload()

      if (editingId != null) {
        await updateSearchFilter(editingId, payload)
      } else {
        await createSearchFilter(payload)
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save search filter')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this search filter?')) return
    try {
      await deleteSearchFilter(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete search filter')
    }
  }

  async function handleToggleActive(sf: SearchFilterOut) {
    try {
      await updateSearchFilter(sf.id, { ...sf, is_active: !sf.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update search filter')
    }
  }

  return (
    <div className="admin-section">
      <h2>Search Filters</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="filter-list">
        {filters.length === 0 && <p className="help-text">No search filters yet.</p>}
        {filters.map(sf => (
          <div key={sf.id} className="filter-row">
            <div className="filter-row-main">
              <strong>{sf.name}</strong>
              <span className="mode-badge">{sf.search_mode}</span>
              <span className="filter-detail">
                {sf.search_mode === 'url' ? sf.search_url : `${sf.location}${sf.query ? ` · ${sf.query}` : ''}`}
              </span>
              <span className="results-limit-badge">↓ {sf.results_limit}</span>
              <span className="mode-badge">{profileLabel(sf.criteria_profile_id)}</span>
            </div>
            <div className="filter-row-actions">
              <label className="inline-toggle">
                <input type="checkbox" checked={sf.is_active} onChange={() => handleToggleActive(sf)} />
                Active
              </label>
              <button className="edit-button" onClick={() => startEdit(sf)}>Edit</button>
              <button className="delete-button" onClick={() => handleDelete(sf.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <h3>{editingId != null ? 'Edit Filter' : 'Add New Filter'}</h3>
      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="sf-name">Name</label>
          <input id="sf-name" type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} />
        </div>

        <div className="config-item">
          <label htmlFor="sf-mode">Search Mode</label>
          <select
            id="sf-mode"
            value={form.search_mode}
            onChange={(e) => setForm(prev => ({ ...prev, search_mode: e.target.value as 'url' | 'location' }))}
          >
            <option value="url">Direct URL</option>
            <option value="location">Location + Filters</option>
          </select>
        </div>

        {form.search_mode === 'url' ? (
          <div className="config-item">
            <label htmlFor="sf-url">Facebook Marketplace Search URL</label>
            <input
              id="sf-url"
              type="text"
              placeholder="https://www.facebook.com/marketplace/newyork/search/?query=sedan"
              value={form.search_url}
              onChange={(e) => setForm(prev => ({ ...prev, search_url: e.target.value }))}
            />
          </div>
        ) : (
          <>
            <div className="config-item">
              <label htmlFor="sf-location">Location (Facebook city slug)</label>
              <input
                id="sf-location"
                type="text"
                placeholder="newyork"
                value={form.location}
                onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="config-item">
              <label htmlFor="sf-query">Search Query</label>
              <input id="sf-query" type="text" placeholder="sedan" value={form.query} onChange={(e) => setForm(prev => ({ ...prev, query: e.target.value }))} />
            </div>
            <div className="filter-grid">
              <div className="config-item">
                <label htmlFor="sf-min-price">Min Price</label>
                <input id="sf-min-price" type="number" value={form.min_price} onChange={(e) => setForm(prev => ({ ...prev, min_price: e.target.value }))} />
              </div>
              <div className="config-item">
                <label htmlFor="sf-max-price">Max Price</label>
                <input id="sf-max-price" type="number" value={form.max_price} onChange={(e) => setForm(prev => ({ ...prev, max_price: e.target.value }))} />
              </div>
              <div className="config-item">
                <label htmlFor="sf-radius">Radius (miles)</label>
                <input id="sf-radius" type="number" value={form.radius_miles} onChange={(e) => setForm(prev => ({ ...prev, radius_miles: e.target.value }))} />
              </div>
              <div className="config-item">
                <label htmlFor="sf-days">Days Listed</label>
                <input id="sf-days" type="number" value={form.days_listed} onChange={(e) => setForm(prev => ({ ...prev, days_listed: e.target.value }))} />
              </div>
            </div>
            <div className="config-item">
              <label htmlFor="sf-condition">Condition</label>
              <input id="sf-condition" type="text" placeholder="used" value={form.condition} onChange={(e) => setForm(prev => ({ ...prev, condition: e.target.value }))} />
            </div>
          </>
        )}

        <div className="config-item">
          <label htmlFor="sf-profile">Scoring Prompt</label>
          <select
            id="sf-profile"
            value={form.criteria_profile_id}
            onChange={(e) => setForm(prev => ({ ...prev, criteria_profile_id: e.target.value === '' ? '' : Number(e.target.value) }))}
          >
            <option value="">Default active prompt</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} (v{p.version}){p.is_active ? ' — active' : ''}</option>
            ))}
          </select>
          <p className="help-text">Which prompt scores listings from this search. Leave as default to use whichever prompt is globally active.</p>
        </div>

        <div className="config-item">
          <label htmlFor="sf-results-limit">Results Limit (per scrape)</label>
          <input
            id="sf-results-limit"
            type="number"
            min="10"
            max="500"
            value={form.results_limit}
            onChange={(e) => setForm(prev => ({ ...prev, results_limit: e.target.value }))}
          />
          <p className="help-text">How many listings to fetch from Marketplace (affects Apify costs)</p>
        </div>

        <div className="config-item">
          <label>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))} />
            Active
          </label>
        </div>

        <div className="form-actions">
          <button className="save-button" onClick={handleSubmit} disabled={isSaving || !form.name}>
            {isSaving ? 'Saving...' : editingId != null ? 'Update Filter' : 'Add Filter'}
          </button>
          {editingId != null && (
            <button className="cancel-button" onClick={resetForm}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
