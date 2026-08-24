import { useEffect, useState } from 'react'
import { fetchSchedulerConfig, updateSchedulerConfig, triggerSearch, fetchLLMConfig, updateLLMConfig, runArenaTest } from '../api/client'
import type { SchedulerConfigOut, TriggerSearchResponse, LLMConfigOut, ArenaRunOut } from '../api/types'
import './AdminPanel.css'

export default function AdminPanel() {
  const [config, setConfig] = useState<SchedulerConfigOut | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runResults, setRunResults] = useState<TriggerSearchResponse | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [llmConfig, setLLMConfig] = useState<LLMConfigOut | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [llmError, setLLMError] = useState<string | null>(null)
  const [isSavingLLM, setIsSavingLLM] = useState(false)

  const [arenaResults, setArenaResults] = useState<ArenaRunOut | null>(null)
  const [isRunningArena, setIsRunningArena] = useState(false)
  const [arenaError, setArenaError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    is_enabled: true,
    run_hour: 6,
    run_minute: 0,
  })

  useEffect(() => {
    loadConfig()
    loadLLMConfig()
  }, [])

  async function loadConfig() {
    try {
      setIsLoading(true)
      const data = await fetchSchedulerConfig()
      setConfig(data)
      setFormData({
        is_enabled: data.is_enabled,
        run_hour: data.run_hour,
        run_minute: data.run_minute,
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduler config')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError(null)
      const updated = await updateSchedulerConfig(formData)
      setConfig(updated)
      alert('Scheduler configuration updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scheduler config')
    } finally {
      setIsSaving(false)
    }
  }

  function handleToggleEnabled() {
    setFormData(prev => ({
      ...prev,
      is_enabled: !prev.is_enabled,
    }))
  }

  function handleHourChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hour = parseInt(e.target.value)
    if (hour >= 0 && hour <= 23) {
      setFormData(prev => ({
        ...prev,
        run_hour: hour,
      }))
    }
  }

  function handleMinuteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const minute = parseInt(e.target.value)
    if (minute >= 0 && minute <= 59) {
      setFormData(prev => ({
        ...prev,
        run_minute: minute,
      }))
    }
  }

  async function handleRunSearch() {
    try {
      setIsRunning(true)
      setRunError(null)
      const results = await triggerSearch()
      setRunResults(results)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to trigger search')
    } finally {
      setIsRunning(false)
    }
  }

  async function loadLLMConfig() {
    try {
      const data = await fetchLLMConfig()
      setLLMConfig(data)
      setSelectedProvider(data.current_provider)
      setSelectedModel(data.current_model)
      setLLMError(null)
    } catch (err) {
      setLLMError(err instanceof Error ? err.message : 'Failed to load LLM config')
    }
  }

  async function handleSaveLLMConfig() {
    try {
      setIsSavingLLM(true)
      setLLMError(null)
      await updateLLMConfig({
        provider: selectedProvider,
        model: selectedModel,
      })
      alert('LLM configuration updated successfully!')
      await loadLLMConfig()
    } catch (err) {
      setLLMError(err instanceof Error ? err.message : 'Failed to update LLM config')
    } finally {
      setIsSavingLLM(false)
    }
  }

  function handleProviderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newProvider = e.target.value
    setSelectedProvider(newProvider)
    if (llmConfig) {
      const availableModels = llmConfig.provider_models[newProvider] || []
      setSelectedModel(availableModels[0] || '')
    }
  }

  async function handleRunArenaTest() {
    if (!llmConfig) {
      setArenaError('LLM config not loaded')
      return
    }

    try {
      setIsRunningArena(true)
      setArenaError(null)

      const providers = ['anthropic', 'openai', 'gemini']
      const models = providers.map(p => {
        const availableModels = llmConfig.provider_models[p] || []
        return availableModels[0] || ''
      })

      const results = await runArenaTest({
        listing_id: 1,
        criteria_profile_id: 1,
        providers,
        models,
      })
      setArenaResults(results)
    } catch (err) {
      setArenaError(err instanceof Error ? err.message : 'Failed to run arena test')
    } finally {
      setIsRunningArena(false)
    }
  }

  if (isLoading || !llmConfig) {
    return <div className="admin-panel"><p>Loading...</p></div>
  }

  return (
    <div className="admin-panel">
      <h1>Admin Panel</h1>

      <div className="admin-section">
        <h2>LLM Configuration</h2>

        {llmError && <div className="error-message">{llmError}</div>}

        <div className="llm-config">
          <div className="config-item">
            <label htmlFor="provider">LLM Provider</label>
            <select
              id="provider"
              value={selectedProvider}
              onChange={handleProviderChange}
            >
              {llmConfig.available_providers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="config-item">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {(llmConfig.provider_models[selectedProvider] || []).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            className="save-button"
            onClick={handleSaveLLMConfig}
            disabled={isSavingLLM}
          >
            {isSavingLLM ? 'Saving...' : 'Save LLM Config'}
          </button>
        </div>

        {llmConfig && (
          <div className="config-info">
            <p>Current: {llmConfig.current_provider} / {llmConfig.current_model}</p>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2>Arena Mode - LLM Comparison</h2>

        {arenaError && <div className="error-message">{arenaError}</div>}

        <p className="help-text">Compare all available LLM providers side-by-side on a sample listing.</p>

        <button
          className="run-button"
          onClick={handleRunArenaTest}
          disabled={isRunningArena}
        >
          {isRunningArena ? 'Running Arena Test...' : 'Run Arena Test'}
        </button>

        {arenaResults && (
          <div className="arena-results">
            <h3>Arena Test Results</h3>
            <div className="arena-comparison">
              {arenaResults.results.map((result) => (
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
                        <ul>
                          {result.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                        </ul>
                      </div>
                      <div className="list-section">
                        <strong>Cons:</strong>
                        <ul>
                          {result.cons.map((con, i) => <li key={i}>{con}</li>)}
                        </ul>
                      </div>
                      {result.dealbreaker_flags.length > 0 && (
                        <div className="list-section">
                          <strong>Dealbreakers:</strong>
                          <ul>
                            {result.dealbreaker_flags.map((flag, i) => <li key={i}>{flag}</li>)}
                          </ul>
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

      <div className="admin-section">
        <h2>Scheduler Configuration</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="scheduler-config">
          <div className="config-item">
            <label>
              <input
                type="checkbox"
                checked={formData.is_enabled}
                onChange={handleToggleEnabled}
              />
              Enable Scheduler
            </label>
            <p className="help-text">
              {formData.is_enabled
                ? 'Scheduler is enabled. Automatic scrapes will run at the configured time.'
                : 'Scheduler is disabled. Use manual "Run Now" to trigger scrapes.'}
            </p>
          </div>

          {formData.is_enabled && (
            <div className="time-picker">
              <div className="time-input">
                <label htmlFor="hour">Hour (UTC)</label>
                <input
                  id="hour"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.run_hour}
                  onChange={handleHourChange}
                />
              </div>

              <div className="time-input">
                <label htmlFor="minute">Minute</label>
                <input
                  id="minute"
                  type="number"
                  min="0"
                  max="59"
                  value={formData.run_minute}
                  onChange={handleMinuteChange}
                />
              </div>

              <div className="time-display">
                <strong>Run time: {formData.run_hour.toString().padStart(2, '0')}:{formData.run_minute.toString().padStart(2, '0')} UTC</strong>
              </div>
            </div>
          )}

          <button
            className="save-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {config && (
          <div className="config-info">
            <p>Last updated: {new Date(config.updated_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2>Manual Search Trigger</h2>

        {runError && <div className="error-message">{runError}</div>}

        <p className="help-text">Trigger an immediate search across all active search filters.</p>

        <button
          className="run-button"
          onClick={handleRunSearch}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Now'}
        </button>

        {runResults && (
          <div className="run-results">
            <div className="results-header">
              <strong>✓ {runResults.message}</strong>
            </div>
            <div className="results-grid">
              <div className="result-item">
                <div className="result-label">Filters Triggered</div>
                <div className="result-value">{runResults.filters_triggered}</div>
              </div>
              <div className="result-item">
                <div className="result-label">Listings Processed</div>
                <div className="result-value">{runResults.total_listings_processed}</div>
              </div>
              <div className="result-item">
                <div className="result-label">Scores Created</div>
                <div className="result-value">{runResults.total_scores_created}</div>
              </div>
              <div className="result-item">
                <div className="result-label">Notifications Sent</div>
                <div className="result-value">{runResults.total_notifications_sent}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
