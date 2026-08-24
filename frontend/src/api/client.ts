import type { ListingOut } from './types'

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path)
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
