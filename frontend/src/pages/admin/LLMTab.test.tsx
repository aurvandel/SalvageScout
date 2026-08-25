import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LLMTab from './LLMTab'
import { fetchSettings, updateLLMSettings } from '../../api/client'
import type { AppSettingsOut, LLMSettingsOut } from '../../api/types'

vi.mock('../../api/client')

const mockedFetchSettings = vi.mocked(fetchSettings)
const mockedUpdateLLMSettings = vi.mocked(updateLLMSettings)

function makeLLMSettings(overrides: Partial<LLMSettingsOut> = {}): LLMSettingsOut {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    available_providers: ['anthropic', 'openai'],
    provider_models: {
      anthropic: ['claude-sonnet-5', 'claude-haiku-4'],
      openai: ['gpt-4o', 'gpt-4o-mini'],
    },
    anthropic_api_key_masked: 'sk-...abcd',
    openai_api_key_masked: null,
    gemini_api_key_masked: null,
    ...overrides,
  }
}

function makeAppSettings(llmOverrides: Partial<LLMSettingsOut> = {}): AppSettingsOut {
  return {
    llm: makeLLMSettings(llmOverrides),
    apify: { actor_id: 'apify-actor', apify_token_masked: null },
    notifications: {
      discord_enabled: false,
      discord_webhook_url_masked: null,
      telegram_enabled: false,
      telegram_bot_token_masked: null,
      telegram_chat_id: null,
      notification_score_threshold: 70,
    },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

// This project's vitest.config.ts does not set `test.globals: true`, so React Testing
// Library's automatic afterEach(cleanup) never registers itself. Without this, DOM nodes
// from one test leak into the next within the same file. See final report for details.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LLMTab', () => {
  it('shows a loading state before settings arrive', () => {
    mockedFetchSettings.mockReturnValue(new Promise<AppSettingsOut>(() => {}))

    render(<LLMTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the current provider and model after load', async () => {
    mockedFetchSettings.mockResolvedValue(makeAppSettings())

    render(<LLMTab />)

    await waitFor(() => expect(screen.getByLabelText('Active Provider')).toHaveValue('anthropic'))
    expect(screen.getByLabelText('Model')).toHaveValue('claude-sonnet-5')
  })

  it('updates the available model list when switching provider', async () => {
    mockedFetchSettings.mockResolvedValue(makeAppSettings())
    const user = userEvent.setup()

    render(<LLMTab />)
    await waitFor(() => expect(screen.getByLabelText('Active Provider')).toHaveValue('anthropic'))

    await user.selectOptions(screen.getByLabelText('Active Provider'), 'openai')

    expect(screen.getByLabelText('Model')).toHaveValue('gpt-4o')
    const modelOptions = within(screen.getByLabelText('Model'))
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)
    expect(modelOptions).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  it('shows the masked key as a hint without ever populating the input with a real secret', async () => {
    mockedFetchSettings.mockResolvedValue(makeAppSettings())

    render(<LLMTab />)

    await waitFor(() => expect(screen.getByLabelText(/Anthropic API Key/)).toBeInTheDocument())

    const input = screen.getByLabelText(/Anthropic API Key/) as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.type).toBe('password')
    expect(input.placeholder).toBe('Unchanged')
    expect(screen.getByText('(sk-...abcd)')).toBeInTheDocument()

    // Provider with no masked key shows "Not set" and no masked-value hint.
    const openaiInput = screen.getByLabelText(/OpenAI API Key/) as HTMLInputElement
    expect(openaiInput.value).toBe('')
    expect(openaiInput.placeholder).toBe('Not set')
  })

  it('saves only the fields that were actually entered, plus provider/model', async () => {
    mockedFetchSettings.mockResolvedValue(makeAppSettings())
    mockedUpdateLLMSettings.mockResolvedValue(makeAppSettings({ anthropic_api_key_masked: 'sk-...wxyz' }))
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<LLMTab />)
    await waitFor(() => expect(screen.getByLabelText('Active Provider')).toHaveValue('anthropic'))

    await user.type(screen.getByLabelText(/Anthropic API Key/), 'sk-new-secret')
    await user.click(screen.getByRole('button', { name: /Save LLM Settings/ }))

    await waitFor(() =>
      expect(mockedUpdateLLMSettings).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        anthropic_api_key: 'sk-new-secret',
      }),
    )
    expect(window.alert).toHaveBeenCalledWith('LLM settings updated successfully!')

    // Key field is cleared after a successful save.
    expect((screen.getByLabelText(/Anthropic API Key/) as HTMLInputElement).value).toBe('')
  })

  it('omits blank key fields from the save payload', async () => {
    mockedFetchSettings.mockResolvedValue(makeAppSettings())
    mockedUpdateLLMSettings.mockResolvedValue(makeAppSettings())
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<LLMTab />)
    await waitFor(() => expect(screen.getByLabelText('Active Provider')).toHaveValue('anthropic'))

    await user.click(screen.getByRole('button', { name: /Save LLM Settings/ }))

    await waitFor(() =>
      expect(mockedUpdateLLMSettings).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
      }),
    )
  })

  it('shows an error message when saving fails', async () => {
    mockedFetchSettings.mockResolvedValue(makeAppSettings())
    mockedUpdateLLMSettings.mockRejectedValue(new Error('provider rejected the request'))
    const user = userEvent.setup()

    render(<LLMTab />)
    await waitFor(() => expect(screen.getByLabelText('Active Provider')).toHaveValue('anthropic'))

    await user.click(screen.getByRole('button', { name: /Save LLM Settings/ }))

    await waitFor(() => expect(screen.getByText('provider rejected the request')).toBeInTheDocument())
    // Not stuck in the saving state.
    expect(screen.getByRole('button', { name: 'Save LLM Settings' })).not.toBeDisabled()
  })

  it('stays on the loading view when the initial settings fetch fails (llm state never gets set)', async () => {
    mockedFetchSettings.mockRejectedValue(new Error('network down'))

    render(<LLMTab />)

    // The component only renders the error banner once `llm` is non-null, so a failed
    // initial load leaves the user stuck on the loading placeholder.
    await waitFor(() => expect(mockedFetchSettings).toHaveBeenCalled())
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('network down')).not.toBeInTheDocument()
  })
})
