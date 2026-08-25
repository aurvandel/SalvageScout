import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApifyTab from './ApifyTab'
import { fetchSettings, updateApifySettings } from '../../api/client'
import type { ApifySettingsOut, AppSettingsOut } from '../../api/types'

vi.mock('../../api/client', () => ({
  fetchSettings: vi.fn(),
  updateApifySettings: vi.fn(),
}))

// vitest.config.ts does not set test.globals, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) is a
// no-op here; clean up explicitly to avoid renders leaking across tests.
afterEach(cleanup)

function makeApify(overrides: Partial<ApifySettingsOut> = {}): ApifySettingsOut {
  return {
    actor_id: 'apify/facebook-marketplace-scraper',
    apify_token_masked: '****abcd',
    ...overrides,
  }
}

function makeSettings(apifyOverrides: Partial<ApifySettingsOut> = {}): AppSettingsOut {
  return {
    llm: {
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      available_providers: ['anthropic'],
      provider_models: { anthropic: ['claude-sonnet-5'] },
      anthropic_api_key_masked: null,
      openai_api_key_masked: null,
      gemini_api_key_masked: null,
    },
    apify: makeApify(apifyOverrides),
    notifications: {
      discord_enabled: true,
      discord_webhook_url_masked: null,
      telegram_enabled: false,
      telegram_bot_token_masked: null,
      telegram_chat_id: null,
      notification_score_threshold: 70,
    },
  }
}

const mockedFetchSettings = vi.mocked(fetchSettings)
const mockedUpdateApifySettings = vi.mocked(updateApifySettings)

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('ApifyTab', () => {
  it('shows a loading state before settings resolve', () => {
    mockedFetchSettings.mockReturnValue(new Promise(() => {}))

    render(<ApifyTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the loaded actor id and masked token', async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings())

    render(<ApifyTab />)

    expect(await screen.findByLabelText('Actor ID')).toHaveValue('apify/facebook-marketplace-scraper')
    expect(screen.getByText('(****abcd)')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('does not render a masked-value span when no token is set', async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings({ apify_token_masked: null }))

    render(<ApifyTab />)

    await screen.findByLabelText('Actor ID')
    expect(screen.queryByText(/\(\*+/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Not set')).toBeInTheDocument()
  })

  it('saves only the actor_id when no new token is entered', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateApifySettings.mockResolvedValue(makeSettings({ actor_id: 'new-actor' }))

    render(<ApifyTab />)

    const actorInput = await screen.findByLabelText('Actor ID')
    await user.clear(actorInput)
    await user.type(actorInput, 'new-actor')
    await user.click(screen.getByRole('button', { name: /save apify settings/i }))

    await waitFor(() => {
      expect(mockedUpdateApifySettings).toHaveBeenCalledWith({ actor_id: 'new-actor' })
    })
    expect(window.alert).toHaveBeenCalledWith('Apify settings updated successfully!')
  })

  it('includes apify_token in the payload when a new token is entered, and clears it after save', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateApifySettings.mockResolvedValue(makeSettings({ apify_token_masked: '****new1' }))

    render(<ApifyTab />)

    const tokenInput = await screen.findByLabelText(/Apify API Token/)
    await user.type(tokenInput, 'super-secret-token')
    await user.click(screen.getByRole('button', { name: /save apify settings/i }))

    await waitFor(() => {
      expect(mockedUpdateApifySettings).toHaveBeenCalledWith({
        actor_id: 'apify/facebook-marketplace-scraper',
        apify_token: 'super-secret-token',
      })
    })

    // token field is reset after a successful save; the raw secret never renders as text
    await waitFor(() => expect(tokenInput).toHaveValue(''))
    expect(screen.queryByText('super-secret-token')).not.toBeInTheDocument()
    expect(screen.getByText('(****new1)')).toBeInTheDocument()
  })

  it('shows an error message when saving fails, without leaking implementation details', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateApifySettings.mockRejectedValue(new Error('Network error'))

    render(<ApifyTab />)

    await screen.findByLabelText('Actor ID')
    await user.click(screen.getByRole('button', { name: /save apify settings/i }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('re-enables the save button after a failed save', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateApifySettings.mockRejectedValue(new Error('boom'))

    render(<ApifyTab />)

    await screen.findByLabelText('Actor ID')
    const saveButton = screen.getByRole('button', { name: /save apify settings/i })
    await user.click(saveButton)

    await waitFor(() => expect(saveButton).not.toBeDisabled())
    expect(saveButton).toHaveTextContent('Save Apify Settings')
  })
})
