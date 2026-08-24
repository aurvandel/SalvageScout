export interface ScoreOut {
  id: number
  match_score: number
  summary: string
  pros: string[]
  cons: string[]
  dealbreaker_flags: string[]
  model_used: string
  created_at: string
}

export interface ListingImageOut {
  id: number
  local_path: string
  position: number
  image_url: string
}

export interface ListingOut {
  id: number
  fb_listing_id: string
  url: string
  title: string
  description: string | null
  price_amount: number | null
  currency: string | null
  strikethrough_price_amount: number | null
  condition: string | null
  is_live: boolean
  is_pending: boolean
  is_sold: boolean
  location_text: string | null
  year: number | null
  make: string | null
  model: string | null
  mileage: number | null
  posted_at: string | null
  first_seen_at: string
  last_seen_at: string
  images: ListingImageOut[]
  scores: ScoreOut[]
}
