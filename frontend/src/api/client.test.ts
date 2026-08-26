import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as client from './client'
import { makeListing } from '../test/fixtures'
import type {
  ListingPage,
  SchedulerConfigOut,
  TriggerSearchResponse,
  AppSettingsOut,
  SearchFilterOut,
  CriteriaProfileOut,
  ArenaRunOut,
} from './types'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  mockFetch.mockClear()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const mockSettings: AppSettingsOut = {
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    available_providers: ['anthropic', 'openai'],
    provider_models: { anthropic: ['claude-sonnet-5'], openai: ['gpt-4'] },
    anthropic_api_key_masked: '***key***',
    openai_api_key_masked: null,
    gemini_api_key_masked: null,
  },
  apify: { actor_id: '123', apify_token_masked: '***token***' },
  scraper: {
    provider: 'apify',
    available_providers: ['apify', 'scrape_creators'],
    bright_data_api_key_masked: null,
    bright_data_enrichment_enabled: false,
    scrape_creators_api_key_masked: null,
    incompatible_filter_names: [],
  },
  notifications: {
    discord_enabled: false,
    discord_webhook_url_masked: null,
    telegram_enabled: false,
    telegram_bot_token_masked: null,
    telegram_chat_id: null,
    notification_score_threshold: 70,
  },
}

const mockSearchFilter: SearchFilterOut = {
  id: 1,
  name: 'Filter 1',
  is_active: true,
  search_mode: 'url',
  search_url: 'https://example.com',
  location: null,
  query: null,
  min_price: null,
  max_price: null,
  radius_miles: null,
  days_listed: null,
  condition: null,
  results_limit: 100,
  criteria_profile_id: null,
  sort_by: null,
  delivery_method: null,
  availability: null,
}

const mockCriteriaProfile: CriteriaProfileOut = {
  id: 1,
  name: 'Salvage Profile',
  prompt_text: 'Evaluate for salvage potential...',
  weights: { condition: 0.3, price: 0.4, mileage: 0.3 },
  is_active: true,
  version: 1,
  created_at: '2026-08-01T10:00:00Z',
}

// ============================================================================
// URL CONSTRUCTION & QUERY PARAMETER TESTS
// ============================================================================

describe('fetchListings - URL construction and query parameters', () => {
  it('constructs correct URL with no parameters', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({})

    expect(mockFetch).toHaveBeenCalledWith('/api/listings', undefined)
  })

  it('constructs correct URL with only minScore', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ minScore: 75 })

    expect(mockFetch).toHaveBeenCalledWith('/api/listings?min_score=75', undefined)
  })

  it('constructs correct URL with only view', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ view: 'favorites' })

    expect(mockFetch).toHaveBeenCalledWith('/api/listings?view=favorites', undefined)
  })

  it('constructs correct URL with only limit', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ limit: 10 })

    expect(mockFetch).toHaveBeenCalledWith('/api/listings?limit=10', undefined)
  })

  it('constructs correct URL with only offset', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ offset: 20 })

    expect(mockFetch).toHaveBeenCalledWith('/api/listings?offset=20', undefined)
  })

  it('constructs correct URL with some parameters (minScore + limit)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ minScore: 60, limit: 15 })

    expect(mockFetch).toHaveBeenCalledWith('/api/listings?min_score=60&limit=15', undefined)
  })

  it('constructs correct URL with only searchFilterId', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ searchFilterId: 3 })

    expect(mockFetch).toHaveBeenCalledWith('/api/listings?search_filter_id=3', undefined)
  })

  it('constructs correct URL with all parameters in declared order', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({
      minScore: 80,
      view: 'hidden',
      searchFilterId: 3,
      limit: 25,
      offset: 50,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/listings?min_score=80&view=hidden&search_filter_id=3&limit=25&offset=50',
      undefined,
    )
  })

  it('omits parameters that are explicitly undefined', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

    await client.fetchListings({ minScore: 70, limit: undefined, offset: 10 })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/listings?min_score=70&offset=10',
      undefined,
    )
  })
})

// ============================================================================
// HTTP METHOD, HEADERS, AND BODY TESTS
// ============================================================================

describe('HTTP methods, headers, and bodies', () => {
  it('fetchListing issues a plain GET to /api/listings/:id', async () => {
    const mockListing = makeListing()
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    await client.fetchListing(1)

    expect(mockFetch).toHaveBeenCalledWith('/api/listings/1', undefined)
  })

  it('setFavorite issues PATCH with favorite as a query param, no body', async () => {
    const mockListing = makeListing({ is_favorite: true })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    await client.setFavorite(1, true)

    expect(mockFetch).toHaveBeenCalledWith('/api/listings/1/favorite?favorite=true', {
      method: 'PATCH',
    })
  })

  it('setFavorite encodes false correctly', async () => {
    const mockListing = makeListing({ is_favorite: false })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    await client.setFavorite(2, false)

    expect(mockFetch).toHaveBeenCalledWith('/api/listings/2/favorite?favorite=false', {
      method: 'PATCH',
    })
  })

  it('setHidden issues PATCH with hidden as a query param, no body', async () => {
    const mockListing = makeListing({ is_hidden: true })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    await client.setHidden(1, true)

    expect(mockFetch).toHaveBeenCalledWith('/api/listings/1/hide?hidden=true', {
      method: 'PATCH',
    })
  })

  it('deleteListing issues DELETE to /api/listings/:id', async () => {
    const mockListing = makeListing({ is_deleted: true })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    await client.deleteListing(1)

    expect(mockFetch).toHaveBeenCalledWith('/api/listings/1', { method: 'DELETE' })
  })

  it('fetchSchedulerConfig issues a plain GET', async () => {
    const mockConfig: SchedulerConfigOut = {
      id: 1,
      is_enabled: true,
      run_hour: 9,
      run_minute: 0,
      updated_at: '2026-08-01T10:00:00Z',
    }
    mockFetch.mockResolvedValue(jsonResponse(mockConfig))

    await client.fetchSchedulerConfig()

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/scheduler-config', undefined)
  })

  it('updateSchedulerConfig issues PATCH with JSON headers and serialized body', async () => {
    const mockConfig: SchedulerConfigOut = {
      id: 1,
      is_enabled: true,
      run_hour: 9,
      run_minute: 0,
      updated_at: '2026-08-01T10:00:00Z',
    }
    mockFetch.mockResolvedValue(jsonResponse(mockConfig))

    const payload = { is_enabled: true, run_hour: 9, run_minute: 0 }
    await client.updateSchedulerConfig(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/scheduler-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('triggerSearch issues POST with JSON headers and no body', async () => {
    const mockResponse: TriggerSearchResponse = { message: 'Search triggered' }
    mockFetch.mockResolvedValue(jsonResponse(mockResponse))

    await client.triggerSearch()

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/trigger-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('fetchSettings issues a plain GET', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSettings))

    await client.fetchSettings()

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings', undefined)
  })

  it('updateLLMSettings issues PATCH with JSON headers and serialized body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSettings))

    const payload = { provider: 'anthropic', model: 'claude-sonnet-5' }
    await client.updateLLMSettings(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings/llm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('updateApifySettings issues PATCH with JSON headers and serialized body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSettings))

    const payload = { actor_id: '456' }
    await client.updateApifySettings(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings/apify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('updateScraperSettings issues PATCH with JSON headers and serialized body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSettings))

    const payload = { provider: 'scrape_creators' }
    await client.updateScraperSettings(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings/scraper', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('updateNotificationSettings issues PATCH with JSON headers and serialized body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSettings))

    const payload = { discord_enabled: true, notification_score_threshold: 75 }
    await client.updateNotificationSettings(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('fetchSearchFilters issues a plain GET', async () => {
    mockFetch.mockResolvedValue(jsonResponse([mockSearchFilter]))

    await client.fetchSearchFilters()

    expect(mockFetch).toHaveBeenCalledWith('/api/search-filters', undefined)
  })

  it('createSearchFilter issues POST with JSON headers and serialized body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSearchFilter))

    const payload = { name: 'Test Filter', search_mode: 'url' as const }
    await client.createSearchFilter(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/search-filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('updateSearchFilter issues PATCH with JSON headers and serialized body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSearchFilter))

    const payload = { name: 'Updated Filter', is_active: false }
    await client.updateSearchFilter(1, payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/search-filters/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('deleteSearchFilter issues DELETE with no body', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }))

    await client.deleteSearchFilter(1)

    expect(mockFetch).toHaveBeenCalledWith('/api/search-filters/1', { method: 'DELETE' })
  })

  it('fetchCriteriaProfiles issues a plain GET', async () => {
    mockFetch.mockResolvedValue(jsonResponse([mockCriteriaProfile]))

    await client.fetchCriteriaProfiles()

    expect(mockFetch).toHaveBeenCalledWith('/api/criteria-profiles', undefined)
  })

  it('runArenaTest issues POST with JSON headers and serialized body', async () => {
    const mockResult: ArenaRunOut = {
      id: 1,
      listing_id: 1,
      criteria_profile_id: 1,
      providers: ['anthropic'],
      models: ['claude-sonnet-5'],
      results: [
        {
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          match_score: 85,
          summary: 'Great match',
          pros: ['Good condition'],
          cons: [],
          dealbreaker_flags: [],
        },
      ],
      created_at: '2026-08-01T10:00:00Z',
    }
    mockFetch.mockResolvedValue(jsonResponse(mockResult))

    const payload = {
      listing_id: 1,
      criteria_profile_id: 1,
      providers: ['anthropic'],
      models: ['claude-sonnet-5'],
    }
    await client.runArenaTest(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/arena-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })
})

// ============================================================================
// SHARED ERROR PATH TESTS
// ============================================================================

describe('error handling', () => {
  it('fetchListings rejects with an Error including the path and status on 404', async () => {
    mockFetch.mockResolvedValue(new Response('Not found', { status: 404 }))

    await expect(client.fetchListings({})).rejects.toThrow('/api/listings failed: 404')
  })

  it('fetchListings rejects with an Error including the path and status on 500', async () => {
    mockFetch.mockResolvedValue(new Response('Server error', { status: 500 }))

    await expect(client.fetchListings({})).rejects.toThrow('/api/listings failed: 500')
  })

  it('fetchListing rejects with an Error including the path and status', async () => {
    mockFetch.mockResolvedValue(new Response('Not found', { status: 404 }))

    await expect(client.fetchListing(1)).rejects.toThrow('/api/listings/1 failed: 404')
  })

  it('setFavorite rejects with an Error including the path (with query) and status', async () => {
    mockFetch.mockResolvedValue(new Response('Bad request', { status: 400 }))

    await expect(client.setFavorite(1, true)).rejects.toThrow(
      '/api/listings/1/favorite?favorite=true failed: 400',
    )
  })

  it('updateSchedulerConfig rejects with an Error including the path and status', async () => {
    mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }))

    await expect(
      client.updateSchedulerConfig({ is_enabled: true, run_hour: 9, run_minute: 0 }),
    ).rejects.toThrow('/api/admin/scheduler-config failed: 401')
  })

  it('triggerSearch rejects with an Error including the path and status', async () => {
    mockFetch.mockResolvedValue(new Response('Forbidden', { status: 403 }))

    await expect(client.triggerSearch()).rejects.toThrow(
      '/api/admin/trigger-search failed: 403',
    )
  })

  it('createSearchFilter rejects with an Error including the path and status', async () => {
    mockFetch.mockResolvedValue(new Response('Unprocessable', { status: 422 }))

    await expect(client.createSearchFilter({ name: 'Test' })).rejects.toThrow(
      '/api/search-filters failed: 422',
    )
  })

  it('deleteSearchFilter (bespoke error path) rejects with an Error including the path and status', async () => {
    mockFetch.mockResolvedValue(new Response('Not found', { status: 404 }))

    await expect(client.deleteSearchFilter(1)).rejects.toThrow(
      '/api/search-filters/1 failed: 404',
    )
  })

  it('runArenaTest rejects with an Error including the path and status', async () => {
    mockFetch.mockResolvedValue(new Response('Server error', { status: 500 }))

    await expect(
      client.runArenaTest({
        listing_id: 1,
        criteria_profile_id: 1,
        providers: ['anthropic'],
        models: ['claude-sonnet-5'],
      }),
    ).rejects.toThrow('/api/admin/arena-run failed: 500')
  })
})

// ============================================================================
// SUCCESSFUL RESPONSE TESTS
// ============================================================================

describe('successful responses resolve with parsed JSON', () => {
  it('fetchListings resolves with the parsed page', async () => {
    const mockListing = makeListing()
    const mockResponse: ListingPage = { items: [mockListing], has_more: true }
    mockFetch.mockResolvedValue(jsonResponse(mockResponse))

    const result = await client.fetchListings({ limit: 10 })

    expect(result).toEqual(mockResponse)
  })

  it('fetchListing resolves with the parsed listing', async () => {
    const mockListing = makeListing()
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    const result = await client.fetchListing(1)

    expect(result).toEqual(mockListing)
  })

  it('setFavorite resolves with the updated listing', async () => {
    const mockListing = makeListing({ is_favorite: true })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    const result = await client.setFavorite(1, true)

    expect(result).toEqual(mockListing)
  })

  it('setHidden resolves with the updated listing', async () => {
    const mockListing = makeListing({ is_hidden: true })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    const result = await client.setHidden(1, true)

    expect(result).toEqual(mockListing)
  })

  it('deleteListing resolves with the deleted listing', async () => {
    const mockListing = makeListing({ is_deleted: true, deleted_at: '2026-08-02T10:00:00Z' })
    mockFetch.mockResolvedValue(jsonResponse(mockListing))

    const result = await client.deleteListing(1)

    expect(result).toEqual(mockListing)
  })

  it('fetchSchedulerConfig resolves with the parsed config', async () => {
    const mockConfig: SchedulerConfigOut = {
      id: 1,
      is_enabled: true,
      run_hour: 9,
      run_minute: 0,
      updated_at: '2026-08-01T10:00:00Z',
    }
    mockFetch.mockResolvedValue(jsonResponse(mockConfig))

    const result = await client.fetchSchedulerConfig()

    expect(result).toEqual(mockConfig)
  })

  it('updateSchedulerConfig resolves with the parsed config', async () => {
    const mockConfig: SchedulerConfigOut = {
      id: 1,
      is_enabled: false,
      run_hour: 14,
      run_minute: 30,
      updated_at: '2026-08-01T11:00:00Z',
    }
    mockFetch.mockResolvedValue(jsonResponse(mockConfig))

    const result = await client.updateSchedulerConfig({
      is_enabled: false,
      run_hour: 14,
      run_minute: 30,
    })

    expect(result).toEqual(mockConfig)
  })

  it('triggerSearch resolves with the parsed response', async () => {
    const mockResponse: TriggerSearchResponse = { message: 'Search triggered successfully' }
    mockFetch.mockResolvedValue(jsonResponse(mockResponse))

    const result = await client.triggerSearch()

    expect(result).toEqual(mockResponse)
  })

  it('fetchSettings resolves with the parsed settings', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockSettings))

    const result = await client.fetchSettings()

    expect(result).toEqual(mockSettings)
  })

  it('updateLLMSettings resolves with the parsed settings', async () => {
    const updated: AppSettingsOut = {
      ...mockSettings,
      llm: { ...mockSettings.llm, provider: 'openai', model: 'gpt-4' },
    }
    mockFetch.mockResolvedValue(jsonResponse(updated))

    const result = await client.updateLLMSettings({ provider: 'openai', model: 'gpt-4' })

    expect(result.llm.provider).toBe('openai')
    expect(result.llm.model).toBe('gpt-4')
  })

  it('updateApifySettings resolves with the parsed settings', async () => {
    const updated: AppSettingsOut = {
      ...mockSettings,
      apify: { actor_id: '456', apify_token_masked: '***token***' },
    }
    mockFetch.mockResolvedValue(jsonResponse(updated))

    const result = await client.updateApifySettings({ actor_id: '456' })

    expect(result.apify.actor_id).toBe('456')
  })

  it('updateScraperSettings resolves with the parsed settings', async () => {
    const updated: AppSettingsOut = {
      ...mockSettings,
      scraper: { ...mockSettings.scraper, provider: 'scrape_creators' },
    }
    mockFetch.mockResolvedValue(jsonResponse(updated))

    const result = await client.updateScraperSettings({ provider: 'scrape_creators' })

    expect(result.scraper.provider).toBe('scrape_creators')
  })

  it('updateNotificationSettings resolves with the parsed settings', async () => {
    const updated: AppSettingsOut = {
      ...mockSettings,
      notifications: {
        ...mockSettings.notifications,
        discord_enabled: true,
        notification_score_threshold: 75,
      },
    }
    mockFetch.mockResolvedValue(jsonResponse(updated))

    const result = await client.updateNotificationSettings({
      discord_enabled: true,
      notification_score_threshold: 75,
    })

    expect(result.notifications.discord_enabled).toBe(true)
    expect(result.notifications.notification_score_threshold).toBe(75)
  })

  it('fetchSearchFilters resolves with the parsed array', async () => {
    mockFetch.mockResolvedValue(jsonResponse([mockSearchFilter]))

    const result = await client.fetchSearchFilters()

    expect(result).toEqual([mockSearchFilter])
  })

  it('createSearchFilter resolves with the parsed filter', async () => {
    const created: SearchFilterOut = { ...mockSearchFilter, id: 2, name: 'New Filter' }
    mockFetch.mockResolvedValue(jsonResponse(created))

    const result = await client.createSearchFilter({ name: 'New Filter' })

    expect(result).toEqual(created)
  })

  it('updateSearchFilter resolves with the parsed filter', async () => {
    const updated: SearchFilterOut = { ...mockSearchFilter, location: 'Seattle, WA' }
    mockFetch.mockResolvedValue(jsonResponse(updated))

    const result = await client.updateSearchFilter(1, { location: 'Seattle, WA' })

    expect(result.location).toBe('Seattle, WA')
  })

  it('deleteSearchFilter resolves with undefined on success', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }))

    const result = await client.deleteSearchFilter(1)

    expect(result).toBeUndefined()
  })

  it('fetchCriteriaProfiles resolves with the parsed array', async () => {
    mockFetch.mockResolvedValue(jsonResponse([mockCriteriaProfile]))

    const result = await client.fetchCriteriaProfiles()

    expect(result).toEqual([mockCriteriaProfile])
  })

  it('runArenaTest resolves with the parsed run result', async () => {
    const mockResult: ArenaRunOut = {
      id: 1,
      listing_id: 1,
      criteria_profile_id: 1,
      providers: ['anthropic', 'openai'],
      models: ['claude-sonnet-5', 'gpt-4'],
      results: [
        {
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          match_score: 85,
          summary: 'Great match',
          pros: ['Good condition', 'Low price'],
          cons: ['High mileage'],
          dealbreaker_flags: [],
        },
        {
          provider: 'openai',
          model: 'gpt-4',
          match_score: 78,
          summary: 'Good match',
          pros: ['Good condition'],
          cons: ['High mileage', 'Poor interior'],
          dealbreaker_flags: [],
        },
      ],
      created_at: '2026-08-01T10:00:00Z',
    }
    mockFetch.mockResolvedValue(jsonResponse(mockResult))

    const result = await client.runArenaTest({
      listing_id: 1,
      criteria_profile_id: 1,
      providers: ['anthropic', 'openai'],
      models: ['claude-sonnet-5', 'gpt-4'],
    })

    expect(result).toEqual(mockResult)
    expect(result.results).toHaveLength(2)
  })
})
