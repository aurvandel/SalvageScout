import type { ListingOut, ScoreOut } from './types'

export function latestScore(listing: ListingOut): ScoreOut | null {
  if (listing.scores.length === 0) return null
  return [...listing.scores].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]
}

export function formatPrice(amount: number | null, currency: string | null): string {
  if (amount == null) return 'Price n/a'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}
