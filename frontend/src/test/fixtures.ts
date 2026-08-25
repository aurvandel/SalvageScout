import type { ListingImageOut, ListingOut, ScoreOut } from '../api/types'

export function makeImage(overrides: Partial<ListingImageOut> = {}): ListingImageOut {
  return {
    id: 1,
    local_path: '/data/images/1.jpg',
    position: 0,
    image_url: 'https://example.com/images/1.jpg',
    ...overrides,
  }
}

export function makeScore(overrides: Partial<ScoreOut> = {}): ScoreOut {
  return {
    id: 1,
    match_score: 80,
    summary: 'Strong candidate for salvage.',
    pros: ['Clean title', 'Low mileage'],
    cons: ['Needs tires'],
    dealbreaker_flags: [],
    model_used: 'claude-sonnet-5',
    created_at: '2026-08-01T12:00:00Z',
    ...overrides,
  }
}

export function makeListing(overrides: Partial<ListingOut> = {}): ListingOut {
  return {
    id: 1,
    fb_listing_id: 'fb-1',
    url: 'https://facebook.com/marketplace/item/1',
    title: '2015 Honda Civic',
    description: 'Runs great, minor body damage.',
    price_amount: 8500,
    currency: 'USD',
    strikethrough_price_amount: null,
    condition: 'Used - good',
    is_live: true,
    is_pending: false,
    is_sold: false,
    is_favorite: false,
    is_hidden: false,
    is_deleted: false,
    deleted_at: null,
    location_text: 'Portland, OR',
    latitude: 45.5152,
    longitude: -122.6784,
    year: 2015,
    make: 'Honda',
    model: 'Civic',
    mileage: 62000,
    posted_at: '2026-08-01T10:00:00Z',
    first_seen_at: '2026-08-01T10:05:00Z',
    last_seen_at: '2026-08-02T10:05:00Z',
    viewed_at: null,
    images: [makeImage()],
    scores: [makeScore()],
    ...overrides,
  }
}
