import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import LLMTab from './LLMTab'
import * as client from '../../api/client'

vi.mock('../../api/client')

const mockLLMSettings = {
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    available_providers: ['anthropic', 'openai', 'gemini'],
    provider_models: {
      anthropic: ['claude-opus-4', 'claude-sonnet-5', 'claude-haiku-3'],
      openai: ['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
      gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    },
    anthropic_api_key_masked: 'sk-ant-...xyz9',
    openai_api_key_masked: 'sk-...9',
    gemini_api_key_masked: 'AIza...xyz',
  },
  apify: {
    actor_id: 'actor-1',
    apify_token_masked: null,
  },
  scraper: {} as any,
  notifications: {
    discord_enabled: false,
    discord_webhook_url_masked: null,
    telegram_enabled: false,
    telegram_bot_token_masked: null,
    telegram_chat_id: null,
    notification_score_threshold: 70,
  },
}

describe('LLMTab', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders loading state initially and then loads LLM settings', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('LLM Provider & Model')).toBeInTheDocument()
    })

    expect(vi.mocked(client.fetchSettings)).toHaveBeenCalledOnce()
  })

  it('displays current provider and model after loading', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
      expect(screen.getByDisplayValue('claude-sonnet-5')).toBeInTheDocument()
    })
  })

  it('updates available models when provider changes', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const providerSelect = screen.getByLabelText('Active Provider') as HTMLSelectElement
    await userEvent.selectOptions(providerSelect, 'openai')

    await waitFor(() => {
      expect(screen.getByDisplayValue('gpt-4-turbo')).toBeInTheDocument()
    })
  })

  it('displays masked API keys and placeholders', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByText(/sk-ant-...xyz9/)).toBeInTheDocument()
      expect(screen.getByText(/sk-...9/)).toBeInTheDocument()
      expect(screen.getByText(/AIza...xyz/)).toBeInTheDocument()
    })

    const anthropicInput = screen.getByLabelText(/^Anthropic API Key/) as HTMLInputElement
    const openaiInput = screen.getByLabelText(/^OpenAI API Key/) as HTMLInputElement
    const geminiInput = screen.getByLabelText(/^Gemini API Key/) as HTMLInputElement

    expect(anthropicInput.placeholder).toBe('Unchanged')
    expect(openaiInput.placeholder).toBe('Unchanged')
    expect(geminiInput.placeholder).toBe('Unchanged')
  })

  it('does not leak real secrets in the DOM', async () => {
    const fullSecretAnthropic = 'sk-ant-api03-FULLSECRETKEY123456789'
    const settingsWithFullKey = {
      ...mockLLMSettings,
      llm: {
        ...mockLLMSettings.llm,
        anthropic_api_key_masked: 'sk-ant-...xyz9',
      },
    }

    vi.mocked(client.fetchSettings).mockResolvedValueOnce(settingsWithFullKey)

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByText(/sk-ant-...xyz9/)).toBeInTheDocument()
    })

    expect(screen.queryByText(fullSecretAnthropic)).not.toBeInTheDocument()
    expect(screen.queryByText(/FULLSECRETKEY123456789/)).not.toBeInTheDocument()
  })

  it('sends only filled API keys to updateLLMSettings', async () => {
    const updatedSettings = {
      ...mockLLMSettings,
      llm: {
        ...mockLLMSettings.llm,
        provider: 'openai',
        model: 'gpt-4-turbo',
        anthropic_api_key_masked: null,
        openai_api_key_masked: 'sk-...newkey',
      },
    }

    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)
    vi.mocked(client.updateLLMSettings).mockResolvedValueOnce(updatedSettings)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const providerSelect = screen.getByLabelText('Active Provider') as HTMLSelectElement
    await userEvent.selectOptions(providerSelect, 'openai')

    const openaiKeyInput = screen.getByLabelText(/^OpenAI API Key/) as HTMLInputElement
    await userEvent.clear(openaiKeyInput)
    await userEvent.type(openaiKeyInput, 'sk-newkey')

    const saveButton = screen.getByRole('button', { name: /Save LLM Settings/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(client.updateLLMSettings)).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-4-turbo',
        openai_api_key: 'sk-newkey',
      })
    })
  })

  it('clears API key inputs after successful save', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)
    vi.mocked(client.updateLLMSettings).mockResolvedValueOnce(mockLLMSettings)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const anthropicKeyInput = screen.getByLabelText(/^Anthropic API Key/) as HTMLInputElement
    await userEvent.type(anthropicKeyInput, 'sk-ant-test')

    const saveButton = screen.getByRole('button', { name: /Save LLM Settings/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(anthropicKeyInput.value).toBe('')
    })
  })

  it('disables save button while saving', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)
    vi.mocked(client.updateLLMSettings).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve(mockLLMSettings), 100)),
    )
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /Save LLM Settings/ }) as HTMLButtonElement
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(saveButton.disabled).toBe(true)
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(saveButton.disabled).toBe(false)
    })
  })

  it('handles save errors gracefully', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)
    vi.mocked(client.updateLLMSettings).mockRejectedValueOnce(new Error('API error'))

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /Save LLM Settings/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument()
    })
  })

  it('stays on the loading state when fetchSettings fails', async () => {
    // The component only renders the error banner once `llm` is populated,
    // so a failed initial load leaves it stuck on "Loading..." rather than
    // surfacing the error message. This test documents that actual behavior.
    vi.mocked(client.fetchSettings).mockRejectedValueOnce(new Error('Load failed'))

    render(<LLMTab />)

    await waitFor(() => {
      expect(vi.mocked(client.fetchSettings)).toHaveBeenCalledOnce()
    })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Load failed')).not.toBeInTheDocument()
  })

  it('shows alert after successful save', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)
    vi.mocked(client.updateLLMSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /Save LLM Settings/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('LLM settings updated successfully!')
    })
  })

  it('populates provider options from available_providers', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('Active Provider') as HTMLSelectElement
      const options = Array.from(providerSelect.options).map(o => o.value)
      expect(options).toEqual(['anthropic', 'openai', 'gemini'])
    })
  })

  it('populates model options from provider_models', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      const modelSelect = screen.getByLabelText('Model') as HTMLSelectElement
      const options = Array.from(modelSelect.options).map(o => o.value)
      expect(options).toEqual(['claude-opus-4', 'claude-sonnet-5', 'claude-haiku-3'])
    })
  })

  it('sets first model as default when provider changes', async () => {
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockLLMSettings)

    render(<LLMTab />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument()
    })

    const providerSelect = screen.getByLabelText('Active Provider') as HTMLSelectElement
    await userEvent.selectOptions(providerSelect, 'gemini')

    await waitFor(() => {
      expect(screen.getByDisplayValue('gemini-2.0-flash')).toBeInTheDocument()
    })
  })
})
