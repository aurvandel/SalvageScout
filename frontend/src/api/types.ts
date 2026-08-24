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

export interface SchedulerConfigOut {
  id: number
  is_enabled: boolean
  run_hour: number
  run_minute: number
  updated_at: string
}

export interface TriggerSearchResponse {
  message: string
  filters_triggered: number
  total_listings_processed: number
  total_scores_created: number
  total_notifications_sent: number
}

export interface LLMConfigOut {
  current_provider: string
  current_model: string
  available_providers: string[]
  provider_models: Record<string, string[]>
}

export interface ArenaScoreResult {
  provider: string
  model: string
  match_score: number
  summary: string
  pros: string[]
  cons: string[]
  dealbreaker_flags: string[]
}

export interface ArenaRunOut {
  id: number
  listing_id: number
  criteria_profile_id: number
  providers: string[]
  models: string[]
  results: ArenaScoreResult[]
  created_at: string
}
