import { useEffect, useState } from 'react'
import { fetchCriteriaProfiles, createCriteriaProfile, activateCriteriaProfile } from '../../api/client'
import type { CriteriaProfileOut } from '../../api/types'

const emptyForm = {
  name: '',
  prompt_text: '',
  weights: {},
  is_active: false,
}

export default function PromptsTab() {
  const [profiles, setProfiles] = useState<CriteriaProfileOut[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchCriteriaProfiles()
      setProfiles(data.sort((a, b) => b.version - a.version))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load criteria profiles')
    }
  }

  function startNew(fromProfile?: CriteriaProfileOut) {
    setEditingId(null)
    if (fromProfile) {
      setForm({
        name: fromProfile.name,
        prompt_text: fromProfile.prompt_text,
        weights: fromProfile.weights || {},
        is_active: false,
      })
    } else {
      setForm(emptyForm)
    }
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.prompt_text.trim()) {
      setError('Name and prompt text are required')
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      await createCriteriaProfile({
        name: form.name,
        prompt_text: form.prompt_text,
        weights: form.weights,
        is_active: form.is_active,
      })
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save criteria profile')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleActivate(profileId: number) {
    try {
      setError(null)
      await activateCriteriaProfile(profileId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate criteria profile')
    }
  }

  const activeProfile = profiles.find(p => p.is_active)

  return (
    <div className="admin-section">
      <h2>Scoring Prompts</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="profiles-list">
        {profiles.length === 0 && <p className="help-text">No criteria profiles yet. Create one below.</p>}
        {profiles.map(profile => (
          <div key={profile.id} className="profile-row">
            <div className="profile-row-main">
              <strong>{profile.name}</strong>
              <span className="version-badge">v{profile.version}</span>
              {profile.is_active && <span className="active-badge">Active</span>}
              <span className="created-at">{new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
            <div className="profile-row-actions">
              {!profile.is_active && (
                <button className="activate-button" onClick={() => handleActivate(profile.id)}>
                  Activate
                </button>
              )}
              <button className="edit-button" onClick={() => startNew(profile)}>
                New Version
              </button>
            </div>
          </div>
        ))}
      </div>

      <h3>{editingId != null ? 'Edit Prompt' : 'Create New Prompt'}</h3>
      <p className="help-text">
        {editingId != null ? 'Saving creates a new version while preserving the original.' : 'New versions create a permanent record so existing scores remain interpretable.'}
      </p>

      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="profile-name">Profile Name</label>
          <input
            id="profile-name"
            type="text"
            placeholder="e.g., High-End SUV Finder"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="config-item">
          <label htmlFor="prompt-text">Scoring Prompt</label>
          <textarea
            id="prompt-text"
            placeholder="Enter the system prompt used for scoring listings..."
            value={form.prompt_text}
            onChange={(e) => setForm(prev => ({ ...prev, prompt_text: e.target.value }))}
            rows={10}
          />
          <p className="help-text">This prompt will be used as the system message when scoring listings with the LLM.</p>
        </div>

        <div className="config-item">
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
            />
            Set as active immediately after saving
          </label>
        </div>

        <div className="button-group">
          <button className="save-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Prompt'}
          </button>
          {editingId !== null && (
            <button className="cancel-button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
