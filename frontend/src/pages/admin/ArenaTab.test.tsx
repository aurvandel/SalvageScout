import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import ArenaTab from './ArenaTab'
import * as client from '../../api/client'
import { makeListing } from '../../test/fixtures'

vi.mock('../../api/client')

const mockListings = [
  makeListing({ id: 1, title: '2015 Honda Civic', price_amount: 8500 }),
  makeListing({ id: 2, title: '2018 Toyota Camry', price_amount: 14000 }),
]

const mockProfiles = [
  {
    id: 1,
    name: 'Salvage Hunter',
    prompt_text: 'Look for salvage deals',
    weights: {},
    is_active: true,
    version: 1,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Daily Driver',
    prompt_text: 'Look for reliable cars',
    weights: {},
    is_active: false,
    version: 1,
    created_at: '2026-08-01T00:00:00Z',
  },
]

const mockLLMSettings = {
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  available_providers: ['anthropic', 'openai'],
  provider_models: {
    anthropic: ['claude-opus-4', 'claude-sonnet-5'],
    openai: ['gpt-4-turbo', 'gpt-4o'],
  },
  anthropic_api_key_masked: 'sk-ant-...xyz9',
  openai_api_key_masked: 'sk-...9',
  gemini_api_key_masked: null,
}

const mockSettings = {
  llm: mockLLMSettings,
  apify: {
    actor_id: 'actor-1',
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

const mockArenaResult = {
  id: 1,
  listing_id: 1,
  criteria_profile_id: 1,
  providers: ['anthropic', 'openai'],
  models: ['claude-sonnet-5', 'gpt-4-turbo'],
  results: [
    {
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      match_score: 85,
      summary: 'Great match',
      pros: ['Low mileage', 'Clean title'],
      cons: ['Needs tires'],
      dealbreaker_flags: [],
    },
    {
      provider: 'openai',
      model: 'gpt-4-turbo',
      match_score: 72,
      summary: 'Decent match',
      pros: ['Good price'],
      cons: ['High mileage', 'Old model'],
      dealbreaker_flags: ['Salvage title'],
    },
  ],
  created_at: '2026-08-25T00:00:00Z',
}

function mockLoadCalls() {
  vi.mocked(client.fetchListings).mockResolvedValueOnce({ items: mockListings, has_more: false })
  vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)
  vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockSettings)
}

describe('ArenaTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially then loads data', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Arena Mode — LLM Comparison')).toBeInTheDocument()
    })

    expect(vi.mocked(client.fetchListings)).toHaveBeenCalledWith({ limit: 50 })
    expect(vi.mocked(client.fetchCriteriaProfiles)).toHaveBeenCalledOnce()
    expect(vi.mocked(client.fetchSettings)).toHaveBeenCalledOnce()
  })

  it('populates listing select with fetched listings', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText(/2015 Honda Civic/)).toBeInTheDocument()
      expect(screen.getByText(/2018 Toyota Camry/)).toBeInTheDocument()
    })
  })

  it('populates criteria profile select with active profile marked', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText(/Salvage Hunter \(active\)/)).toBeInTheDocument()
      expect(screen.getByText('Daily Driver')).toBeInTheDocument()
    })
  })

  it('defaults to the active profile', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    await waitFor(() => {
      const profileSelect = screen.getByLabelText('Criteria Profile') as HTMLSelectElement
      expect(profileSelect.value).toBe('1')
    })
  })

  it('defaults to the first listing', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    await waitFor(() => {
      const listingSelect = screen.getByLabelText('Listing') as HTMLSelectElement
      expect(listingSelect.value).toBe('1')
    })
  })

  it('populates provider checkboxes and model selects from LLM settings', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('anthropic')).toBeInTheDocument()
      expect(screen.getByText('openai')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    checkboxes.forEach(cb => expect((cb as HTMLInputElement).checked).toBe(true))
  })

  it('calls runArenaTest with selected listing, profile, providers, and models', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockResolvedValueOnce(mockArenaResult)

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('Arena Mode — LLM Comparison')).toBeInTheDocument()
    })

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(vi.mocked(client.runArenaTest)).toHaveBeenCalledWith({
        listing_id: 1,
        criteria_profile_id: 1,
        providers: ['anthropic', 'openai'],
        models: ['claude-opus-4', 'gpt-4-turbo'],
      })
    })
  })

  it('excludes unchecked providers from the run', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockResolvedValueOnce(mockArenaResult)

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('anthropic')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[1])

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(vi.mocked(client.runArenaTest)).toHaveBeenCalledWith({
        listing_id: 1,
        criteria_profile_id: 1,
        providers: ['anthropic'],
        models: ['claude-opus-4'],
      })
    })
  })

  it('renders results once the run resolves', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockResolvedValueOnce(mockArenaResult)

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('Arena Mode — LLM Comparison')).toBeInTheDocument()
    })

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(screen.getByText('Arena Test Results')).toBeInTheDocument()
    })

    expect(screen.getByText(/anthropic \/ claude-sonnet-5/)).toBeInTheDocument()
    expect(screen.getByText('85/100')).toBeInTheDocument()
    expect(screen.getByText('Great match')).toBeInTheDocument()
    expect(screen.getByText(/openai \/ gpt-4-turbo/)).toBeInTheDocument()
    expect(screen.getByText('72/100')).toBeInTheDocument()
    expect(screen.getByText('Salvage title')).toBeInTheDocument()
  })

  it('does not render dealbreakers section when there are none', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockResolvedValueOnce(mockArenaResult)

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('Arena Mode — LLM Comparison')).toBeInTheDocument()
    })

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(screen.getByText('Arena Test Results')).toBeInTheDocument()
    })

    const anthropicCard = screen.getByText(/anthropic \/ claude-sonnet-5/).closest('.arena-card')
    expect(anthropicCard).not.toBeNull()
    expect(anthropicCard!.textContent).not.toContain('Dealbreakers:')
  })

  it('shows loading state and disables run button while running', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve(mockArenaResult), 100)),
    )

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('Arena Mode — LLM Comparison')).toBeInTheDocument()
    })

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ }) as HTMLButtonElement
    await userEvent.click(runButton)

    expect(runButton.disabled).toBe(true)
    expect(screen.getByText('Running Arena Test...')).toBeInTheDocument()

    await waitFor(() => {
      expect(runButton.disabled).toBe(false)
    })
  })

  it('shows error when run fails', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockRejectedValueOnce(new Error('Arena run failed'))

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('Arena Mode — LLM Comparison')).toBeInTheDocument()
    })

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(screen.getByText('Arena run failed')).toBeInTheDocument()
    })
  })

  it('shows error when no providers are selected', async () => {
    mockLoadCalls()

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('anthropic')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(screen.getByText('Select at least one provider to compare')).toBeInTheDocument()
    })

    expect(vi.mocked(client.runArenaTest)).not.toHaveBeenCalled()
  })

  it('handles load errors', async () => {
    vi.mocked(client.fetchListings).mockRejectedValueOnce(new Error('Failed to load'))
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)
    vi.mocked(client.fetchSettings).mockResolvedValueOnce(mockSettings)

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  it('allows changing the model for a provider', async () => {
    mockLoadCalls()
    vi.mocked(client.runArenaTest).mockResolvedValueOnce(mockArenaResult)

    render(<ArenaTab />)

    await waitFor(() => {
      expect(screen.getByText('anthropic')).toBeInTheDocument()
    })

    const modelSelects = screen.getAllByRole('combobox').filter(el => {
      const select = el as HTMLSelectElement
      return Array.from(select.options).some(o => o.value === 'claude-opus-4')
    })
    expect(modelSelects.length).toBeGreaterThan(0)

    await userEvent.selectOptions(modelSelects[0] as HTMLSelectElement, 'claude-opus-4')

    const runButton = screen.getByRole('button', { name: /Run Arena Test/ })
    await userEvent.click(runButton)

    await waitFor(() => {
      expect(vi.mocked(client.runArenaTest)).toHaveBeenCalledWith(
        expect.objectContaining({
          models: expect.arrayContaining(['claude-opus-4']),
        }),
      )
    })
  })
})
