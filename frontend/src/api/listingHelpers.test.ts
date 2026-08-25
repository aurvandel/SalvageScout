import { describe, expect, it } from 'vitest'
import { formatPrice, latestScore } from './listingHelpers'
import { makeListing, makeScore } from '../test/fixtures'

describe('latestScore', () => {
  it('returns null when the listing has no scores', () => {
    expect(latestScore(makeListing({ scores: [] }))).toBeNull()
  })

  it('returns the single score when only one exists', () => {
    const score = makeScore({ id: 1 })
    expect(latestScore(makeListing({ scores: [score] }))).toEqual(score)
  })

  it('returns the most recently created score without mutating the original array', () => {
    const older = makeScore({ id: 1, created_at: '2026-01-01T00:00:00Z' })
    const newer = makeScore({ id: 2, created_at: '2026-06-01T00:00:00Z' })
    const listing = makeListing({ scores: [older, newer] })

    expect(latestScore(listing)?.id).toBe(2)
    expect(listing.scores).toEqual([older, newer])
  })
})

describe('formatPrice', () => {
  it('returns "Price n/a" when amount is null', () => {
    expect(formatPrice(null, 'USD')).toBe('Price n/a')
  })

  it('formats a whole-dollar USD amount with no decimals', () => {
    expect(formatPrice(8500, 'USD')).toBe('$8,500')
  })

  it('defaults to USD when currency is null', () => {
    expect(formatPrice(100, null)).toBe('$100')
  })
})
