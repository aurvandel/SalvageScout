import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsTab from './NotificationsTab'
import { fetchSettings, updateNotificationSettings } from '../../api/client'
import type { AppSettingsOut, NotificationSettingsOut } from '../../api/types'

vi.mock('../../api/client', () => ({
  fetchSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
}))

// vitest.config.ts does not set test.globals, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) is a
// no-op here; clean up explicitly to avoid renders leaking across tests.
afterEach(cleanup)

function makeNotifications(overrides: Partial<NotificationSettingsOut> = {}): NotificationSettingsOut {
  return {
    discord_enabled: true,
    discord_webhook_url_masked: '****hook',
    telegram_enabled: false,
    telegram_bot_token_masked: '****tok1',
    telegram_chat_id: '123456',
    notification_score_threshold: 70,
    ...overrides,
  }
}

function makeSettings(notifOverrides: Partial<NotificationSettingsOut> = {}): AppSettingsOut {
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
    apify: { actor_id: 'apify/facebook-marketplace-scraper', apify_token_masked: null },
    notifications: makeNotifications(notifOverrides),
  }
}

const mockedFetchSettings = vi.mocked(fetchSettings)
const mockedUpdateNotificationSettings = vi.mocked(updateNotificationSettings)

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('NotificationsTab', () => {
  it('shows a loading state before settings resolve', () => {
    mockedFetchSettings.mockReturnValue(new Promise(() => {}))

    render(<NotificationsTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the loaded settings, including masked secrets', async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings())

    render(<NotificationsTab />)

    expect(await screen.findByRole('checkbox', { name: /Enable Discord/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Enable Telegram/ })).not.toBeChecked()
    expect(screen.getByText('(****hook)')).toBeInTheDocument()
    expect(screen.getByText('(****tok1)')).toBeInTheDocument()
    expect(screen.getByLabelText('Telegram Chat ID')).toHaveValue('123456')
    expect(screen.getByLabelText('Notification Score Threshold')).toHaveValue(70)
  })

  it('does not render masked-value spans when no secret is set', async () => {
    mockedFetchSettings.mockResolvedValue(
      makeSettings({ discord_webhook_url_masked: null, telegram_bot_token_masked: null }),
    )

    render(<NotificationsTab />)

    await screen.findByRole('checkbox', { name: /Enable Discord/ })
    expect(screen.queryByText(/\(\*+/)).not.toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('Not set')).toHaveLength(2)
  })

  it('saves edited fields, always including the base fields and only the entered secrets', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateNotificationSettings.mockResolvedValue(makeSettings())

    render(<NotificationsTab />)

    await screen.findByRole('checkbox', { name: /Enable Discord/ })
    await user.click(screen.getByRole('checkbox', { name: /Enable Telegram/ }))

    const thresholdInput = screen.getByLabelText('Notification Score Threshold')
    await user.clear(thresholdInput)
    await user.type(thresholdInput, '85')

    await user.type(screen.getByLabelText(/Discord Webhook URL/), 'https://discord.example/webhook/secret')

    await user.click(screen.getByRole('button', { name: /save notification settings/i }))

    await waitFor(() => {
      expect(mockedUpdateNotificationSettings).toHaveBeenCalledWith({
        discord_enabled: true,
        telegram_enabled: true,
        telegram_chat_id: '123456',
        notification_score_threshold: 85,
        discord_webhook_url: 'https://discord.example/webhook/secret',
      })
    })
    expect(window.alert).toHaveBeenCalledWith('Notification settings updated successfully!')
  })

  it('omits telegram_bot_token from the payload when left blank, and clears entered secrets after save', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateNotificationSettings.mockResolvedValue(makeSettings({ telegram_bot_token_masked: '****new2' }))

    render(<NotificationsTab />)

    const tokenInput = await screen.findByLabelText(/Telegram Bot Token/)
    await user.type(tokenInput, 'raw-bot-token-value')

    await user.click(screen.getByRole('button', { name: /save notification settings/i }))

    await waitFor(() => {
      const call = mockedUpdateNotificationSettings.mock.calls[0][0]
      expect(call).toMatchObject({ telegram_bot_token: 'raw-bot-token-value' })
      expect(call).not.toHaveProperty('discord_webhook_url')
    })

    await waitFor(() => expect(tokenInput).toHaveValue(''))
    expect(screen.queryByText('raw-bot-token-value')).not.toBeInTheDocument()
    expect(screen.getByText('(****new2)')).toBeInTheDocument()
  })

  it('shows an error message when saving fails', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())
    mockedUpdateNotificationSettings.mockRejectedValue(new Error('Update rejected'))

    render(<NotificationsTab />)

    await screen.findByRole('checkbox', { name: /Enable Discord/ })
    await user.click(screen.getByRole('button', { name: /save notification settings/i }))

    expect(await screen.findByText('Update rejected')).toBeInTheDocument()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('falls back to 0 for a non-numeric threshold value', async () => {
    const user = userEvent.setup()
    mockedFetchSettings.mockResolvedValue(makeSettings())

    render(<NotificationsTab />)

    const thresholdInput = await screen.findByLabelText('Notification Score Threshold')
    await user.clear(thresholdInput)

    expect(thresholdInput).toHaveValue(0)
  })
})
