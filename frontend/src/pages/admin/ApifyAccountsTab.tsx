import { useEffect, useState } from 'react'
import { fetchApifyAccounts, createApifyAccount, updateApifyAccount, deleteApifyAccount } from '../../api/client'
import type { ApifyAccountOut } from '../../api/types'

const emptyForm = {
  label: '',
  api_token: '',
  priority: '100',
  is_active: true,
}

export default function ApifyAccountsTab() {
  const [accounts, setAccounts] = useState<ApifyAccountOut[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchApifyAccounts()
      setAccounts(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Apify accounts')
    }
  }

  function startEdit(account: ApifyAccountOut) {
    setEditingId(account.id)
    setForm({
      label: account.label,
      api_token: '',
      priority: account.priority.toString(),
      is_active: account.is_active,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit() {
    try {
      setIsSaving(true)
      setError(null)
      const payload: { label: string; api_token?: string; priority: number; is_active: boolean } = {
        label: form.label,
        priority: parseInt(form.priority) || 100,
        is_active: form.is_active,
      }
      if (form.api_token) payload.api_token = form.api_token

      if (editingId != null) {
        await updateApifyAccount(editingId, payload)
      } else {
        if (!form.api_token) {
          setError('API token is required')
          return
        }
        await createApifyAccount({ ...payload, api_token: form.api_token })
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Apify account')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this Apify account?')) return
    try {
      await deleteApifyAccount(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete Apify account')
    }
  }

  async function handleToggleActive(account: ApifyAccountOut) {
    try {
      await updateApifyAccount(account.id, { is_active: !account.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Apify account')
    }
  }

  return (
    <div className="admin-section">
      <h2>Apify Accounts</h2>
      <p className="help-text">
        Configure more than one Apify account (e.g. separate accounts for different people) to spread scraping
        costs across their monthly usage caps. Accounts are tried in priority order (lowest first); when one hits
        its usage limit, is rate-limited, or has an invalid token, the pipeline automatically retries with the
        next account. There's no limit on how many accounts you can add.
      </p>
      {error && <div className="error-message">{error}</div>}

      <div className="filter-list">
        {accounts.length === 0 && <p className="help-text">No Apify accounts configured yet.</p>}
        {accounts.map(account => (
          <div key={account.id} className="filter-row">
            <div className="filter-row-main">
              <strong>{account.label}</strong>
              <span className="mode-badge">priority {account.priority}</span>
              <span className="filter-detail">{account.api_token_masked || 'not set'}</span>
              {account.last_used_at && (
                <span className="filter-detail">last used {new Date(account.last_used_at).toLocaleString()}</span>
              )}
              {account.last_error && (
                <span className="filter-detail">last error: {account.last_error}</span>
              )}
            </div>
            <div className="filter-row-actions">
              <label className="inline-toggle">
                <input type="checkbox" checked={account.is_active} onChange={() => handleToggleActive(account)} />
                Active
              </label>
              <button className="edit-button" onClick={() => startEdit(account)}>Edit</button>
              <button className="delete-button" onClick={() => handleDelete(account.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <h3>{editingId != null ? 'Edit Account' : 'Add New Account'}</h3>
      <div className="settings-form">
        <div className="config-item">
          <label htmlFor="account-label">Label</label>
          <input
            id="account-label"
            type="text"
            placeholder="Parker's account"
            value={form.label}
            onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
          />
        </div>

        <div className="config-item">
          <label htmlFor="account-token">API Token</label>
          <input
            id="account-token"
            type="password"
            placeholder={editingId != null ? 'Unchanged' : 'Not set'}
            value={form.api_token}
            onChange={(e) => setForm(prev => ({ ...prev, api_token: e.target.value }))}
          />
        </div>

        <div className="config-item">
          <label htmlFor="account-priority">Priority</label>
          <input
            id="account-priority"
            type="number"
            value={form.priority}
            onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
          />
          <p className="help-text">Lower numbers are tried first.</p>
        </div>

        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>

        <div className="form-actions">
          <button className="save-button" onClick={handleSubmit} disabled={isSaving || !form.label}>
            {isSaving ? 'Saving...' : editingId != null ? 'Update Account' : 'Add Account'}
          </button>
          {editingId != null && (
            <button className="cancel-button" onClick={resetForm}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
