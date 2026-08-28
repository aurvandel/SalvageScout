import { useEffect, useRef, useState } from 'react'
import { fetchLogs, fetchSystemStatus } from '../../api/client'
import type { ConnectionStatus, LogEntryOut, SystemStatusOut } from '../../api/types'

const LLM_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
}

const SCRAPER_LABELS: Record<string, string> = {
  apify: 'Apify',
  scrape_creators: 'ScrapeCreators',
  bright_data: 'Bright Data',
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  error: 'Error',
  not_configured: 'Not Configured',
}

const MAX_DISPLAYED_LOGS = 500
const POLL_INTERVAL_MS = 2000
const AUTO_SCROLL_THRESHOLD_PX = 40

function StatusBadge({ status }: { status: ConnectionStatus }) {
  return <span className={`status-badge status-badge-${status.replace(/_/g, '-')}`}>{STATUS_LABELS[status]}</span>
}

export default function StatusTab() {
  const [status, setStatus] = useState<SystemStatusOut | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [logs, setLogs] = useState<LogEntryOut[]>([])
  const [logsError, setLogsError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  const sinceIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const logViewerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (isPaused) return

    let cancelled = false

    async function poll() {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        const data = await fetchLogs(sinceIdRef.current)
        if (cancelled) return
        sinceIdRef.current = data.last_id
        if (data.logs.length > 0) {
          setLogs(prev => [...prev, ...data.logs].slice(-MAX_DISPLAYED_LOGS))
        }
        setLogsError(null)
      } catch (err) {
        if (!cancelled) {
          setLogsError(err instanceof Error ? err.message : 'Failed to load logs')
        }
      } finally {
        inFlightRef.current = false
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isPaused])

  useEffect(() => {
    if (autoScrollRef.current && logViewerRef.current) {
      logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight
    }
  }, [logs])

  function handleLogScroll() {
    const el = logViewerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    autoScrollRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX
  }

  async function loadStatus() {
    try {
      setIsRefreshing(true)
      const data = await fetchSystemStatus()
      setStatus(data)
      setStatusError(null)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to load system status')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <>
      <div className="admin-section">
        <div className="status-section-header">
          <h2>Connection Status</h2>
          <button className="save-button" onClick={loadStatus} disabled={isRefreshing}>
            {isRefreshing ? 'Checking...' : 'Refresh'}
          </button>
        </div>
        {statusError && <div className="error-message">{statusError}</div>}

        {!status && !statusError && <p>Loading...</p>}

        {status && (
          <>
            <h3 className="usage-subheading">LLM Providers</h3>
            <div className="filter-list">
              {status.llm.map(row => (
                <div className="filter-row" key={row.provider}>
                  <div className="filter-row-main">
                    <strong>{LLM_LABELS[row.provider] || row.provider}</strong>
                    <StatusBadge status={row.status} />
                  </div>
                  {row.error && <span className="filter-detail">{row.error}</span>}
                </div>
              ))}
            </div>

            <h3 className="usage-subheading">Scrapers</h3>
            <div className="filter-list">
              {status.scrapers.map(row => (
                <div className="filter-row" key={`${row.provider}-${row.label ?? ''}`}>
                  <div className="filter-row-main">
                    <strong>
                      {SCRAPER_LABELS[row.provider] || row.provider}
                      {row.label && ` — ${row.label}`}
                    </strong>
                    <StatusBadge status={row.status} />
                  </div>
                  {row.error && <span className="filter-detail">{row.error}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="admin-section">
        <div className="status-section-header">
          <h2>Live Logs</h2>
          <div className="button-group">
            <button className="cancel-button" onClick={() => setIsPaused(p => !p)}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button className="cancel-button" onClick={() => setLogs([])}>
              Clear
            </button>
          </div>
        </div>
        {logsError && <div className="error-message">{logsError}</div>}

        <div className="log-viewer" ref={logViewerRef} onScroll={handleLogScroll}>
          {logs.length === 0 ? (
            <p className="help-text">No log activity yet.</p>
          ) : (
            logs.map(entry => (
              <div key={entry.id} className={`log-line log-level-${entry.level.toLowerCase()}`}>
                <span className="log-timestamp">{new Date(entry.created_at).toLocaleTimeString()}</span>
                <span className="log-logger">{entry.logger_name}</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
