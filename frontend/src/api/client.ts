import type {
  ListingOut,
  ListingPage,
  ListingView,
  SchedulerConfigOut,
  TriggerSearchResponse,
  AppSettingsOut,
  ArenaRunOut,
  SearchFilterOut,
  CriteriaProfileIn,
  CriteriaProfileOut,
} from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchListings(params: {
  minScore?: number
  view?: ListingView
  limit?: number
  offset?: number
}): Promise<ListingPage> {
  const query = new URLSearchParams()
  if (params.minScore != null) query.set('min_score', String(params.minScore))
  if (params.view != null) query.set('view', params.view)
  if (params.limit != null) query.set('limit', String(params.limit))
  if (params.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  return request<ListingPage>(`/api/listings${qs ? `?${qs}` : ''}`)
}

export function fetchListing(id: number): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}`)
}

export function setFavorite(id: number, favorite: boolean): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}/favorite?favorite=${favorite}`, { method: 'PATCH' })
}

export function setHidden(id: number, hidden: boolean): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}/hide?hidden=${hidden}`, { method: 'PATCH' })
}

export function deleteListing(id: number): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}`, { method: 'DELETE' })
}

export function fetchSchedulerConfig(): Promise<SchedulerConfigOut> {
  return request<SchedulerConfigOut>('/api/admin/scheduler-config')
}

export async function updateSchedulerConfig(config: {
  is_enabled: boolean
  run_hour: number
  run_minute: number
}): Promise<SchedulerConfigOut> {
  return request<SchedulerConfigOut>('/api/admin/scheduler-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export function triggerSearch(): Promise<TriggerSearchResponse> {
  return request<TriggerSearchResponse>('/api/admin/trigger-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

export function fetchSettings(): Promise<AppSettingsOut> {
  return request<AppSettingsOut>('/api/admin/settings')
}

export function updateLLMSettings(fields: {
  provider?: string
  model?: string
  anthropic_api_key?: string
  openai_api_key?: string
  gemini_api_key?: string
}): Promise<AppSettingsOut> {
  return request<AppSettingsOut>('/api/admin/settings/llm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export function updateApifySettings(fields: {
  apify_token?: string
  actor_id?: string
}): Promise<AppSettingsOut> {
  return request<AppSettingsOut>('/api/admin/settings/apify', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export function updateNotificationSettings(fields: {
  discord_enabled?: boolean
  discord_webhook_url?: string
  telegram_enabled?: boolean
  telegram_bot_token?: string
  telegram_chat_id?: string
  notification_score_threshold?: number
}): Promise<AppSettingsOut> {
  return request<AppSettingsOut>('/api/admin/settings/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export function fetchSearchFilters(): Promise<SearchFilterOut[]> {
  return request<SearchFilterOut[]>('/api/search-filters')
}

export function createSearchFilter(payload: Partial<SearchFilterOut>): Promise<SearchFilterOut> {
  return request<SearchFilterOut>('/api/search-filters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateSearchFilter(id: number, payload: Partial<SearchFilterOut>): Promise<SearchFilterOut> {
  return request<SearchFilterOut>(`/api/search-filters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteSearchFilter(id: number): Promise<void> {
  const response = await fetch(`/api/search-filters/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`/api/search-filters/${id} failed: ${response.status}`)
  }
}

export function fetchCriteriaProfiles(): Promise<CriteriaProfileOut[]> {
  return request<CriteriaProfileOut[]>('/api/criteria-profiles')
}

export function createCriteriaProfile(payload: CriteriaProfileIn): Promise<CriteriaProfileOut> {
  return request<CriteriaProfileOut>('/api/criteria-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function activateCriteriaProfile(profileId: number): Promise<CriteriaProfileOut> {
  return request<CriteriaProfileOut>(`/api/criteria-profiles/${profileId}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function runArenaTest(params: {
  listing_id: number
  criteria_profile_id: number
  providers: string[]
  models: string[]
}): Promise<ArenaRunOut> {
  return request<ArenaRunOut>('/api/admin/arena-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}
