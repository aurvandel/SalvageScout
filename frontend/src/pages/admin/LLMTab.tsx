import { useEffect, useState } from 'react'
import { fetchSettings, updateLLMSettings } from '../../api/client'
import type { LLMSettingsOut } from '../../api/types'

export default function LLMTab() {
  const [llm, setLLM] = useState<LLMSettingsOut | null>(null)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [keys, setKeys] = useState({ anthropic_api_key: '', openai_api_key: '', gemini_api_key: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchSettings()
      setLLM(data.llm)
      setProvider(data.llm.provider)
      setModel(data.llm.model)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load LLM settings')
    }
  }

  function handleProviderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newProvider = e.target.value
    setProvider(newProvider)
    const availableModels = llm?.provider_models[newProvider] || []
    setModel(availableModels[0] || '')
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError(null)
      const fields: Record<string, string> = { provider, model }
      if (keys.anthropic_api_key) fields.anthropic_api_key = keys.anthropic_api_key
      if (keys.openai_api_key) fields.openai_api_key = keys.openai_api_key
      if (keys.gemini_api_key) fields.gemini_api_key = keys.gemini_api_key

      const updated = await updateLLMSettings(fields)
      setLLM(updated.llm)
      setKeys({ anthropic_api_key: '', openai_api_key: '', gemini_api_key: '' })
      alert('LLM settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update LLM settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!llm) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  return (
    <div className="admin-section">
      <h2>LLM Provider &amp; Model</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="provider">Active Provider</label>
          <select id="provider" value={provider} onChange={handleProviderChange}>
            {llm.available_providers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="config-item">
          <label htmlFor="model">Model</label>
          <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
            {(llm.provider_models[provider] || []).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <h3>API Keys</h3>
        <p className="help-text">Leave a field blank to keep its current key unchanged.</p>

        <div className="config-item">
          <label htmlFor="anthropic-key">
            Anthropic API Key {llm.anthropic_api_key_masked && <span className="masked-value">({llm.anthropic_api_key_masked})</span>}
          </label>
          <input
            id="anthropic-key"
            type="password"
            placeholder={llm.anthropic_api_key_masked ? 'Unchanged' : 'Not set'}
            value={keys.anthropic_api_key}
            onChange={(e) => setKeys(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
          />
        </div>

        <div className="config-item">
          <label htmlFor="openai-key">
            OpenAI API Key {llm.openai_api_key_masked && <span className="masked-value">({llm.openai_api_key_masked})</span>}
          </label>
          <input
            id="openai-key"
            type="password"
            placeholder={llm.openai_api_key_masked ? 'Unchanged' : 'Not set'}
            value={keys.openai_api_key}
            onChange={(e) => setKeys(prev => ({ ...prev, openai_api_key: e.target.value }))}
          />
        </div>

        <div className="config-item">
          <label htmlFor="gemini-key">
            Gemini API Key {llm.gemini_api_key_masked && <span className="masked-value">({llm.gemini_api_key_masked})</span>}
          </label>
          <input
            id="gemini-key"
            type="password"
            placeholder={llm.gemini_api_key_masked ? 'Unchanged' : 'Not set'}
            value={keys.gemini_api_key}
            onChange={(e) => setKeys(prev => ({ ...prev, gemini_api_key: e.target.value }))}
          />
        </div>

        <button className="save-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save LLM Settings'}
        </button>
      </div>
    </div>
  )
}
