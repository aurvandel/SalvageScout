import { useEffect, useState } from 'react'
import { fetchUsage } from '../../api/client'
import type { UsageOut } from '../../api/types'

function formatUsd(value: number | null): string {
  if (value == null) return '—'
  return `$${value.toFixed(2)}`
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

export default function UsageTab() {
  const [usage, setUsage] = useState<UsageOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchUsage()
      setUsage(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage')
    }
  }

  if (error) {
    return (
      <div className="admin-section">
        <h2>Usage</h2>
        <div className="error-message">{error}</div>
      </div>
    )
  }

  if (!usage) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  const apify = usage.apify
  const usedPct = apify.used_usd != null && apify.limit_usd ? Math.min(100, (apify.used_usd / apify.limit_usd) * 100) : null

  return (
    <>
      <div className="admin-section">
        <h2>Apify</h2>
        {!apify.configured && <p className="help-text">No Apify token configured — set one in the Apify tab.</p>}
        {apify.error && <div className="error-message">Couldn't reach Apify: {apify.error}</div>}
        {apify.configured && !apify.error && (
          <div className="settings-form">
            <div className="usage-summary">
              <span>{formatUsd(apify.used_usd)} used</span>
              <span className="usage-summary-sep">/</span>
              <span>{formatUsd(apify.limit_usd)} monthly limit</span>
            </div>
            {usedPct != null && (
              <div className="usage-bar">
                <div
                  className={`usage-bar-fill ${usedPct >= 90 ? 'usage-bar-fill-high' : usedPct >= 60 ? 'usage-bar-fill-mid' : ''}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            )}
            {apify.cycle_start && apify.cycle_end && (
              <p className="help-text">
                Apify billing cycle (not calendar month): {new Date(apify.cycle_start).toLocaleDateString()} – {new Date(apify.cycle_end).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2>ScrapeCreators</h2>
        {!usage.scrape_creators.configured && (
          <p className="help-text">No ScrapeCreators API key configured — set one in the Scraper tab.</p>
        )}
        {usage.scrape_creators.error && (
          <div className="error-message">Couldn't reach ScrapeCreators: {usage.scrape_creators.error}</div>
        )}
        {usage.scrape_creators.configured && !usage.scrape_creators.error && (
          <div className="settings-form">
            <div className="usage-summary">
              <span>{usage.scrape_creators.credits_remaining ?? '—'} credits remaining</span>
            </div>
            <p className="help-text">
              {usage.scrape_creators.credits_used_today != null
                ? `${usage.scrape_creators.credits_used_today} credits used today (${usage.scrape_creators.requests_today} requests)`
                : "Today's usage unavailable"}
            </p>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2>Bright Data</h2>
        {!usage.bright_data.configured && (
          <p className="help-text">No Bright Data API key configured — set one in the Scraper tab.</p>
        )}
        {usage.bright_data.error && (
          <div className="error-message">Couldn't reach Bright Data: {usage.bright_data.error}</div>
        )}
        {usage.bright_data.configured && !usage.bright_data.error && (
          <div className="settings-form">
            <div className="usage-summary">
              <span>{formatUsd(usage.bright_data.balance_usd)} balance</span>
              <span className="usage-summary-sep">/</span>
              <span>{formatUsd(usage.bright_data.pending_balance_usd)} pending next cycle</span>
            </div>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2>LLM Spend (Estimated)</h2>
        <p className="help-text">
          No provider exposes a real credit-balance API, so this is an estimate from tokens used × published pricing —
          not a live account balance. Covers regular scoring only (Arena test runs aren't tracked).
        </p>

        <h3 className="usage-subheading">This month</h3>
        <UsageTable rows={usage.llm_this_month} />

        <h3 className="usage-subheading">All time</h3>
        <UsageTable rows={usage.llm_all_time} />
      </div>
    </>
  )
}

function UsageTable({ rows }: { rows: UsageOut['llm_this_month'] }) {
  if (rows.length === 0) {
    return <p className="help-text">No scoring activity yet.</p>
  }

  return (
    <div className="filter-list">
      {rows.map(row => (
        <div className="filter-row" key={`${row.provider}/${row.model}`}>
          <div className="filter-row-main">
            <span className="mode-badge">{row.provider}</span>
            <strong>{row.model}</strong>
            <span className="filter-detail">{row.scored_count} scored</span>
            <span className="filter-detail">{formatTokens(row.input_tokens)} in / {formatTokens(row.output_tokens)} out</span>
          </div>
          <div className="filter-row-actions">
            <span className="result-value" style={{ fontSize: '1.1rem' }}>
              {row.estimated_cost_usd != null ? formatUsd(row.estimated_cost_usd) : 'no pricing data'}
            </span>
            {row.priced_count < row.scored_count && (
              <span className="filter-detail">(priced {row.priced_count} of {row.scored_count} — rest predate token tracking)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
