import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArenaTab from './ArenaTab'
import { fetchCriteriaProfiles, fetchListings, fetchSettings, runArenaTest } from '../../api/client'
import { makeListing } from '../../test/fixtures'
import type { AppSettingsOut, ArenaRunOut, CriteriaProfileOut, ListingPage } from '../../api/types'

vi.mock('../../api/client')

const mockedFetchListings = vi.mocked(fetchListings)
const mockedFetchCriteriaProfiles = vi.mocked(fetchCriteriaProfiles)
const mockedFetchSettings = vi.mocked(fetchSettings)
const mockedRunArenaTest = vi.mocked(runArenaTest)

function makeCriteriaProfile(overrides: Partial<CriteriaProfileOut> = {}): CriteriaProfileOut {
  return {
    id: 1,
    name: 'Default profile',
    prompt_text: 'Evaluate this vehicle...',
    weights: {},
    is_active: false,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeAppSettings(): AppSettingsOut {
  return {
    llm: {
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      available_providers: ['anthropic', 'openai'],
      provider_models: {
        anthropic: ['claude-sonnet-5', 'claude-haiku-4'],
        openai: ['gpt-4o', 'gpt-4o-mini'],
      },
      anthropic_api_key_masked: 'sk-...abcd',
      openai_api_key_masked: 'sk-...wxyz',
      gemini_api_key_masked: null,
    },
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

function makeListingPage(): ListingPage {
  return {
    items: [
      makeListing({ id: 10, title: 'Wrecked Civic', price_amount: 4500 }),
      makeListing({ id: 11, title: 'Salvage Tacoma', price_amount: 8200 }),
    ],
    has_more: false,
  }
}

function makeArenaRun(overrides: Partial<ArenaRunOut> = {}): ArenaRunOut {
  return {
    id: 1,
    listing_id: 10,
    criteria_profile_id: 5,
    providers: ['anthropic', 'openai'],
    models: ['claude-sonnet-5', 'gpt-4o'],
    created_at: '2026-08-20T00:00:00Z',
    results: [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        match_score: 88,
        summary: 'Solid deal with manageable repairs.',
        pros: ['Clean title', 'Low mileage'],
        cons: ['Needs tires'],
        dealbreaker_flags: [],
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        match_score: 62,
        summary: 'Riskier due to frame damage.',
        pros: ['Cheap'],
        cons: ['Frame damage', 'No title'],
        dealbreaker_flags: ['Salvage title not disclosed'],
      },
    ],
    ...overrides,
  }
}

function setupDefaultMocks() {
  mockedFetchListings.mockResolvedValue(makeListingPage())
  mockedFetchCriteriaProfiles.mockResolvedValue([
    makeCriteriaProfile({ id: 4, name: 'Inactive profile', is_active: false }),
    makeCriteriaProfile({ id: 5, name: 'Active profile', is_active: true }),
  ])
  mockedFetchSettings.mockResolvedValue(makeAppSettings())
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

describe('ArenaTab', () => {
  it('shows a loading state before setup data arrives', () => {
    mockedFetchListings.mockReturnValue(new Promise<ListingPage>(() => {}))
    mockedFetchCriteriaProfiles.mockReturnValue(new Promise<CriteriaProfileOut[]>(() => {}))
    mockedFetchSettings.mockReturnValue(new Promise<AppSettingsOut>(() => {}))

    render(<ArenaTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('populates the listing and profile selects, defaulting to the first listing and the active profile', async () => {
    setupDefaultMocks()

    render(<ArenaTab />)

    await waitFor(() => expect(screen.getByLabelText('Listing')).toBeInTheDocument())

    const listingSelect = screen.getByLabelText('Listing') as HTMLSelectElement
    expect(within(listingSelect).getAllByRole('option')).toHaveLength(2)
    expect(listingSelect).toHaveValue('10')
    expect(screen.getByRole('option', { name: 'Wrecked Civic — $4500' })).toBeInTheDocument()

    const profileSelect = screen.getByLabelText('Criteria Profile') as HTMLSelectElement
    expect(profileSelect).toHaveValue('5')
    expect(screen.getByRole('option', { name: 'Active profile (active)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Inactive profile' })).toBeInTheDocument()
  })

  it('defaults every available provider to included, with its first model selected', async () => {
    setupDefaultMocks()

    render(<ArenaTab />)

    await waitFor(() => expect(screen.getByLabelText('anthropic')).toBeInTheDocument())

    expect(screen.getByLabelText('anthropic')).toBeChecked()
    expect(screen.getByLabelText('openai')).toBeChecked()

    const anthropicRow = screen.getByLabelText('anthropic').closest('.arena-provider-row') as HTMLElement
    expect(within(anthropicRow).getByRole('combobox')).toHaveValue('claude-sonnet-5')
    const openaiRow = screen.getByLabelText('openai').closest('.arena-provider-row') as HTMLElement
    expect(within(openaiRow).getByRole('combobox')).toHaveValue('gpt-4o')
  })

  it('runs the arena test with the selected listing, profile, providers and models', async () => {
    setupDefaultMocks()
    mockedRunArenaTest.mockResolvedValue(makeArenaRun())
    const user = userEvent.setup()

    render(<ArenaTab />)
    await waitFor(() => expect(screen.getByLabelText('Listing')).toHaveValue('10'))

    await user.click(screen.getByRole('button', { name: 'Run Arena Test' }))

    await waitFor(() =>
      expect(mockedRunArenaTest).toHaveBeenCalledWith({
        listing_id: 10,
        criteria_profile_id: 5,
        providers: ['anthropic', 'openai'],
        models: ['claude-sonnet-5', 'gpt-4o'],
      }),
    )
  })

  it('excludes unchecked providers and their models from the run', async () => {
    setupDefaultMocks()
    mockedRunArenaTest.mockResolvedValue(makeArenaRun({ providers: ['anthropic'], models: ['claude-sonnet-5'] }))
    const user = userEvent.setup()

    render(<ArenaTab />)
    await waitFor(() => expect(screen.getByLabelText('openai')).toBeChecked())

    await user.click(screen.getByLabelText('openai'))
    await user.click(screen.getByRole('button', { name: 'Run Arena Test' }))

    await waitFor(() =>
      expect(mockedRunArenaTest).toHaveBeenCalledWith({
        listing_id: 10,
        criteria_profile_id: 5,
        providers: ['anthropic'],
        models: ['claude-sonnet-5'],
      }),
    )
  })

  it('shows an error and does not call runArenaTest when no provider is selected', async () => {
    setupDefaultMocks()
    const user = userEvent.setup()

    render(<ArenaTab />)
    await waitFor(() => expect(screen.getByLabelText('anthropic')).toBeChecked())

    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByLabelText('openai'))
    await user.click(screen.getByRole('button', { name: 'Run Arena Test' }))

    expect(await screen.findByText('Select at least one provider to compare')).toBeInTheDocument()
    expect(mockedRunArenaTest).not.toHaveBeenCalled()
  })

  it('shows a running state while the request is in flight, then renders results', async () => {
    setupDefaultMocks()
    let resolveRun: (value: ArenaRunOut) => void = () => {}
    mockedRunArenaTest.mockReturnValue(
      new Promise<ArenaRunOut>((resolve) => {
        resolveRun = resolve
      }),
    )
    const user = userEvent.setup()

    render(<ArenaTab />)
    await waitFor(() => expect(screen.getByLabelText('Listing')).toHaveValue('10'))

    await user.click(screen.getByRole('button', { name: 'Run Arena Test' }))

    expect(screen.getByRole('button', { name: 'Running Arena Test...' })).toBeDisabled()
    expect(screen.queryByText('Arena Test Results')).not.toBeInTheDocument()

    resolveRun(makeArenaRun())

    await waitFor(() => expect(screen.getByText('Arena Test Results')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Run Arena Test' })).not.toBeDisabled()
  })

  it('renders each result with its score, summary, pros, cons, and dealbreakers only when present', async () => {
    setupDefaultMocks()
    mockedRunArenaTest.mockResolvedValue(makeArenaRun())
    const user = userEvent.setup()

    render(<ArenaTab />)
    await waitFor(() => expect(screen.getByLabelText('Listing')).toHaveValue('10'))
    await user.click(screen.getByRole('button', { name: 'Run Arena Test' }))
    await waitFor(() => expect(screen.getByText('Arena Test Results')).toBeInTheDocument())

    expect(screen.getByText('anthropic / claude-sonnet-5')).toBeInTheDocument()
    expect(screen.getByText('88/100')).toBeInTheDocument()
    expect(screen.getByText('Solid deal with manageable repairs.')).toBeInTheDocument()
    expect(screen.getByText('Clean title')).toBeInTheDocument()
    expect(screen.getByText('Needs tires')).toBeInTheDocument()

    expect(screen.getByText('openai / gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('62/100')).toBeInTheDocument()
    expect(screen.getByText('Salvage title not disclosed')).toBeInTheDocument()

    // The anthropic result has no dealbreaker flags, so no "Dealbreakers:" section for its card.
    const anthropicCard = screen.getByText('anthropic / claude-sonnet-5').closest('.arena-card') as HTMLElement
    expect(within(anthropicCard).queryByText('Dealbreakers:')).not.toBeInTheDocument()

    const openaiCard = screen.getByText('openai / gpt-4o').closest('.arena-card') as HTMLElement
    expect(within(openaiCard).getByText('Dealbreakers:')).toBeInTheDocument()
  })

  it('shows an error message when the run fails and resets the running state', async () => {
    setupDefaultMocks()
    mockedRunArenaTest.mockRejectedValue(new Error('scoring service unavailable'))
    const user = userEvent.setup()

    render(<ArenaTab />)
    await waitFor(() => expect(screen.getByLabelText('Listing')).toHaveValue('10'))

    await user.click(screen.getByRole('button', { name: 'Run Arena Test' }))

    await waitFor(() => expect(screen.getByText('scoring service unavailable')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Run Arena Test' })).not.toBeDisabled()
  })

  it('stays on the loading view when the initial setup data fails to load (llm state never gets set)', async () => {
    mockedFetchListings.mockRejectedValue(new Error('setup failed'))
    mockedFetchCriteriaProfiles.mockResolvedValue([])
    mockedFetchSettings.mockResolvedValue(makeAppSettings())

    render(<ArenaTab />)

    // llm state never gets set since Promise.all rejects, so it stays on the loading view.
    await waitFor(() => expect(mockedFetchListings).toHaveBeenCalled())
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
