import type { ListingOut, SchedulerConfigOut, TriggerSearchResponse, LLMConfigOut, ArenaRunOut } from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchListings(minScore?: number): Promise<ListingOut[]> {
  const query = minScore != null ? `?min_score=${minScore}` : ''
  return request<ListingOut[]>(`/api/listings${query}`)
}

export function fetchListing(id: number): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}`)
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

export function fetchLLMConfig(): Promise<LLMConfigOut> {
  return request<LLMConfigOut>('/api/admin/llm-config')
}

export async function updateLLMConfig(config: {
  provider: string
  model: string
}): Promise<{ message: string }> {
  return request<{ message: string }>('/api/admin/llm-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
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
