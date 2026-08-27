import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApifyAccountsTab from './ApifyAccountsTab'
import * as client from '../../api/client'

vi.mock('../../api/client')

const mockAccounts = [
  {
    id: 1,
    label: "Parker's account",
    api_token_masked: '****1234',
    priority: 100,
    is_active: true,
    last_used_at: null,
    last_error: null,
    last_error_at: null,
  },
  {
    id: 2,
    label: "Wife's account",
    api_token_masked: '****5678',
    priority: 200,
    is_active: false,
    last_used_at: null,
    last_error: 'invalid token',
    last_error_at: '2026-08-27T00:00:00Z',
  },
]

describe('ApifyAccountsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders and loads accounts', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValueOnce(mockAccounts)

    render(<ApifyAccountsTab />)

    await waitFor(() => {
      expect(screen.getByText("Parker's account")).toBeInTheDocument()
    })
    expect(screen.getByText("Wife's account")).toBeInTheDocument()
    expect(vi.mocked(client.fetchApifyAccounts)).toHaveBeenCalledOnce()
  })

  it('shows a message when there are no accounts yet', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValueOnce([])

    render(<ApifyAccountsTab />)

    await waitFor(() => {
      expect(screen.getByText('No Apify accounts configured yet.')).toBeInTheDocument()
    })
  })

  it('displays masked tokens, priority, and last error', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValueOnce(mockAccounts)

    render(<ApifyAccountsTab />)

    await waitFor(() => {
      expect(screen.getByText('****1234')).toBeInTheDocument()
    })
    expect(screen.getByText('priority 100')).toBeInTheDocument()
    expect(screen.getByText('last error: invalid token')).toBeInTheDocument()
  })

  it('creates a new account with label, token, and priority', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValue([])
    vi.mocked(client.createApifyAccount).mockResolvedValue(mockAccounts[0])
    const user = userEvent.setup()

    render(<ApifyAccountsTab />)
    await waitFor(() => expect(screen.getByText('No Apify accounts configured yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Label'), "Parker's account")
    await user.type(screen.getByLabelText('API Token'), 'new-token-1234')
    await user.click(screen.getByRole('button', { name: /add account/i }))

    await waitFor(() => {
      expect(client.createApifyAccount).toHaveBeenCalledWith({
        label: "Parker's account",
        priority: 100,
        is_active: true,
        api_token: 'new-token-1234',
      })
    })
  })

  it('requires an api token when creating', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValue([])
    const user = userEvent.setup()

    render(<ApifyAccountsTab />)
    await waitFor(() => expect(screen.getByText('No Apify accounts configured yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Label'), 'no token account')
    await user.click(screen.getByRole('button', { name: /add account/i }))

    await waitFor(() => {
      expect(screen.getByText('API token is required')).toBeInTheDocument()
    })
    expect(client.createApifyAccount).not.toHaveBeenCalled()
  })

  it('updates label without requiring the token to be re-entered', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValue(mockAccounts)
    vi.mocked(client.updateApifyAccount).mockResolvedValue(mockAccounts[0])
    const user = userEvent.setup()

    render(<ApifyAccountsTab />)
    await waitFor(() => expect(screen.getByText("Parker's account")).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    const labelInput = screen.getByLabelText('Label') as HTMLInputElement
    await user.clear(labelInput)
    await user.type(labelInput, 'renamed account')
    await user.click(screen.getByRole('button', { name: /update account/i }))

    await waitFor(() => {
      expect(client.updateApifyAccount).toHaveBeenCalledWith(1, {
        label: 'renamed account',
        priority: 100,
        is_active: true,
      })
    })
  })

  it('toggles the active checkbox inline', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValue(mockAccounts)
    vi.mocked(client.updateApifyAccount).mockResolvedValue(mockAccounts[0])
    const user = userEvent.setup()

    render(<ApifyAccountsTab />)
    await waitFor(() => expect(screen.getByText("Parker's account")).toBeInTheDocument())

    const toggles = screen.getAllByRole('checkbox', { name: 'Active' })
    await user.click(toggles[0])

    await waitFor(() => {
      expect(client.updateApifyAccount).toHaveBeenCalledWith(1, { is_active: false })
    })
  })

  it('deletes an account after confirmation', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValue(mockAccounts)
    vi.mocked(client.deleteApifyAccount).mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<ApifyAccountsTab />)
    await waitFor(() => expect(screen.getByText("Parker's account")).toBeInTheDocument())

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(client.deleteApifyAccount).toHaveBeenCalledWith(1)
    })
  })

  it('displays an error message when saving fails', async () => {
    vi.mocked(client.fetchApifyAccounts).mockResolvedValue([])
    vi.mocked(client.createApifyAccount).mockRejectedValue(new Error('Save failed'))
    const user = userEvent.setup()

    render(<ApifyAccountsTab />)
    await waitFor(() => expect(screen.getByText('No Apify accounts configured yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Label'), 'acct')
    await user.type(screen.getByLabelText('API Token'), 'tok')
    await user.click(screen.getByRole('button', { name: /add account/i }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })
})
