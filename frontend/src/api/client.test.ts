import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSearchFilter,
  deleteListing,
  deleteSearchFilter,
  fetchCriteriaProfiles,
  fetchListing,
  fetchListings,
  fetchSchedulerConfig,
  fetchSearchFilters,
  fetchSettings,
  runArenaTest,
  setFavorite,
  setHidden,
  triggerSearch,
  updateApifySettings,
  updateLLMSettings,
  updateNotificationSettings,
  updateSchedulerConfig,
  updateSearchFilter,
} from './client'

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response
}

describe('api/client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('fetchListings', () => {
    it('builds a bare URL with no query string when no params are given', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

      await fetchListings({})

      expect(fetchMock).toHaveBeenCalledWith('/api/listings', undefined)
    })

    it('includes only the params that are set', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

      await fetchListings({ minScore: 75 })

      expect(fetchMock).toHaveBeenCalledWith('/api/listings?min_score=75', undefined)
    })

    it('builds the full query string when all params are provided, in declaration order', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

      await fetchListings({ minScore: 60, view: 'favorites', limit: 20, offset: 40 })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/listings?min_score=60&view=favorites&limit=20&offset=40',
        undefined,
      )
    })

    it('resolves with the parsed JSON body on success', async () => {
      const page = { items: [{ id: 1 }], has_more: true }
      fetchMock.mockResolvedValue(jsonResponse(page))

      const result = await fetchListings({})

      expect(result).toEqual(page)
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }))

      await expect(fetchListings({})).rejects.toThrow('/api/listings failed: 500')
    })

    it('treats offset 0 as a value to include (not skipped as falsy)', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [], has_more: false }))

      await fetchListings({ offset: 0 })

      expect(fetchMock).toHaveBeenCalledWith('/api/listings?offset=0', undefined)
    })
  })

  describe('fetchListing', () => {
    it('requests the listing by id', async () => {
      const listing = { id: 42 }
      fetchMock.mockResolvedValue(jsonResponse(listing))

      const result = await fetchListing(42)

      expect(fetchMock).toHaveBeenCalledWith('/api/listings/42', undefined)
      expect(result).toEqual(listing)
    })
  })

  describe('setFavorite', () => {
    it('PATCHes the favorite flag as a query param', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 1, is_favorite: true }))

      await setFavorite(1, true)

      expect(fetchMock).toHaveBeenCalledWith('/api/listings/1/favorite?favorite=true', {
        method: 'PATCH',
      })
    })

    it('encodes a false value', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 1, is_favorite: false }))

      await setFavorite(1, false)

      expect(fetchMock).toHaveBeenCalledWith('/api/listings/1/favorite?favorite=false', {
        method: 'PATCH',
      })
    })
  })

  describe('setHidden', () => {
    it('PATCHes the hidden flag as a query param', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 2, is_hidden: true }))

      await setHidden(2, true)

      expect(fetchMock).toHaveBeenCalledWith('/api/listings/2/hide?hidden=true', {
        method: 'PATCH',
      })
    })
  })

  describe('deleteListing', () => {
    it('DELETEs the listing by id', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 3, is_deleted: true }))

      await deleteListing(3)

      expect(fetchMock).toHaveBeenCalledWith('/api/listings/3', { method: 'DELETE' })
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }))

      await expect(deleteListing(3)).rejects.toThrow('/api/listings/3 failed: 404')
    })
  })

  describe('fetchSchedulerConfig', () => {
    it('GETs the scheduler config', async () => {
      const config = { id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: 'x' }
      fetchMock.mockResolvedValue(jsonResponse(config))

      const result = await fetchSchedulerConfig()

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/scheduler-config', undefined)
      expect(result).toEqual(config)
    })
  })

  describe('updateSchedulerConfig', () => {
    it('PATCHes with JSON headers and a serialized body', async () => {
      const config = { is_enabled: true, run_hour: 7, run_minute: 30 }
      fetchMock.mockResolvedValue(jsonResponse({ id: 1, ...config, updated_at: 'x' }))

      await updateSchedulerConfig(config)

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/scheduler-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 422 }))

      await expect(
        updateSchedulerConfig({ is_enabled: false, run_hour: 0, run_minute: 0 }),
      ).rejects.toThrow('/api/admin/scheduler-config failed: 422')
    })
  })

  describe('triggerSearch', () => {
    it('POSTs with JSON headers and no body', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'started' }))

      const result = await triggerSearch()

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/trigger-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      expect(result).toEqual({ message: 'started' })
    })
  })

  describe('fetchSettings', () => {
    it('GETs the app settings', async () => {
      const settings = { llm: {}, apify: {}, notifications: {} }
      fetchMock.mockResolvedValue(jsonResponse(settings))

      const result = await fetchSettings()

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings', undefined)
      expect(result).toEqual(settings)
    })
  })

  describe('updateLLMSettings', () => {
    it('PATCHes the llm settings sub-resource with a serialized body', async () => {
      const fields = { provider: 'anthropic', model: 'claude-sonnet-5' }
      fetchMock.mockResolvedValue(jsonResponse({ llm: fields, apify: {}, notifications: {} }))

      await updateLLMSettings(fields)

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/llm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    })
  })

  describe('updateApifySettings', () => {
    it('PATCHes the apify settings sub-resource with a serialized body', async () => {
      const fields = { apify_token: 'secret', actor_id: 'actor-1' }
      fetchMock.mockResolvedValue(jsonResponse({ llm: {}, apify: fields, notifications: {} }))

      await updateApifySettings(fields)

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/apify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }))

      await expect(updateApifySettings({ apify_token: 'bad' })).rejects.toThrow(
        '/api/admin/settings/apify failed: 401',
      )
    })
  })

  describe('updateNotificationSettings', () => {
    it('PATCHes the notifications settings sub-resource with a serialized body', async () => {
      const fields = {
        discord_enabled: true,
        discord_webhook_url: 'https://discord.example/hook',
        notification_score_threshold: 80,
      }
      fetchMock.mockResolvedValue(jsonResponse({ llm: {}, apify: {}, notifications: fields }))

      await updateNotificationSettings(fields)

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    })
  })

  describe('fetchSearchFilters', () => {
    it('GETs the list of search filters', async () => {
      const filters = [{ id: 1, name: 'Sedans' }]
      fetchMock.mockResolvedValue(jsonResponse(filters))

      const result = await fetchSearchFilters()

      expect(fetchMock).toHaveBeenCalledWith('/api/search-filters', undefined)
      expect(result).toEqual(filters)
    })
  })

  describe('createSearchFilter', () => {
    it('POSTs the payload with JSON headers', async () => {
      const payload = { name: 'Trucks', is_active: true }
      fetchMock.mockResolvedValue(jsonResponse({ id: 5, ...payload }))

      await createSearchFilter(payload)

      expect(fetchMock).toHaveBeenCalledWith('/api/search-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 400 }))

      await expect(createSearchFilter({ name: 'Bad' })).rejects.toThrow(
        '/api/search-filters failed: 400',
      )
    })
  })

  describe('updateSearchFilter', () => {
    it('PATCHes the filter by id with a serialized body', async () => {
      const payload = { name: 'Updated name' }
      fetchMock.mockResolvedValue(jsonResponse({ id: 5, ...payload }))

      await updateSearchFilter(5, payload)

      expect(fetchMock).toHaveBeenCalledWith('/api/search-filters/5', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    })
  })

  describe('deleteSearchFilter', () => {
    it('DELETEs the filter by id and resolves with no value on success', async () => {
      fetchMock.mockResolvedValue(jsonResponse(null))

      const result = await deleteSearchFilter(7)

      expect(fetchMock).toHaveBeenCalledWith('/api/search-filters/7', { method: 'DELETE' })
      expect(result).toBeUndefined()
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }))

      await expect(deleteSearchFilter(7)).rejects.toThrow('/api/search-filters/7 failed: 404')
    })
  })

  describe('fetchCriteriaProfiles', () => {
    it('GETs the list of criteria profiles', async () => {
      const profiles = [{ id: 1, name: 'Default' }]
      fetchMock.mockResolvedValue(jsonResponse(profiles))

      const result = await fetchCriteriaProfiles()

      expect(fetchMock).toHaveBeenCalledWith('/api/criteria-profiles', undefined)
      expect(result).toEqual(profiles)
    })
  })

  describe('runArenaTest', () => {
    it('POSTs the arena run params with JSON headers and a serialized body', async () => {
      const params = {
        listing_id: 1,
        criteria_profile_id: 2,
        providers: ['anthropic', 'openai'],
        models: ['claude-sonnet-5', 'gpt-5'],
      }
      const runResult = { id: 9, ...params, results: [], created_at: 'x' }
      fetchMock.mockResolvedValue(jsonResponse(runResult))

      const result = await runArenaTest(params)

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/arena-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      expect(result).toEqual(runResult)
    })

    it('rejects with an Error containing the path and status on a non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }))

      await expect(
        runArenaTest({
          listing_id: 1,
          criteria_profile_id: 2,
          providers: ['anthropic'],
          models: ['claude-sonnet-5'],
        }),
      ).rejects.toThrow('/api/admin/arena-run failed: 503')
    })
  })
})
