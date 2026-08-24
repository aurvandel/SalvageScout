import { useEffect, useState } from 'react'
import { fetchSchedulerConfig, updateSchedulerConfig, triggerSearch } from '../../api/client'
import type { SchedulerConfigOut, TriggerSearchResponse } from '../../api/types'

export default function ScheduleTab() {
  const [config, setConfig] = useState<SchedulerConfigOut | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runResults, setRunResults] = useState<TriggerSearchResponse | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    is_enabled: true,
    run_hour: 6,
    run_minute: 0,
  })

  useEffect(() => {
    loadConfig()
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
    setFormData(prev => ({ ...prev, is_enabled: !prev.is_enabled }))
  }

  function handleHourChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hour = parseInt(e.target.value)
    if (hour >= 0 && hour <= 23) {
      setFormData(prev => ({ ...prev, run_hour: hour }))
    }
  }

  function handleMinuteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const minute = parseInt(e.target.value)
    if (minute >= 0 && minute <= 59) {
      setFormData(prev => ({ ...prev, run_minute: minute }))
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

  if (isLoading) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  return (
    <>
      <div className="admin-section">
        <h2>Scheduler Configuration</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="scheduler-config">
          <div className="config-item">
            <label>
              <input type="checkbox" checked={formData.is_enabled} onChange={handleToggleEnabled} />
              Enable Scheduler
            </label>
            <p className="help-text">
              {formData.is_enabled
                ? 'Scheduler is enabled. Automatic scrapes will run at the configured time, across all active search filters.'
                : 'Scheduler is disabled. Use manual "Run Now" to trigger scrapes.'}
            </p>
          </div>

          {formData.is_enabled && (
            <div className="time-picker">
              <div className="time-input">
                <label htmlFor="hour">Hour (UTC)</label>
                <input id="hour" type="number" min="0" max="23" value={formData.run_hour} onChange={handleHourChange} />
              </div>

              <div className="time-input">
                <label htmlFor="minute">Minute</label>
                <input id="minute" type="number" min="0" max="59" value={formData.run_minute} onChange={handleMinuteChange} />
              </div>

              <div className="time-display">
                <strong>Run time: {formData.run_hour.toString().padStart(2, '0')}:{formData.run_minute.toString().padStart(2, '0')} UTC</strong>
              </div>
            </div>
          )}

          <button className="save-button" onClick={handleSave} disabled={isSaving}>
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

        <button className="run-button" onClick={handleRunSearch} disabled={isRunning}>
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
    </>
  )
}
