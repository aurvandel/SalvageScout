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
  is_favorite: boolean
  is_hidden: boolean
  is_deleted: boolean
  deleted_at: string | null
  viewed_at: string | null
  location_text: string | null
  latitude: number | null
  longitude: number | null
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

export type ListingView = 'active' | 'hidden' | 'favorites'

export interface ListingPage {
  items: ListingOut[]
  has_more: boolean
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
}

export interface LLMSettingsOut {
  provider: string
  model: string
  available_providers: string[]
  provider_models: Record<string, string[]>
  anthropic_api_key_masked: string | null
  openai_api_key_masked: string | null
  gemini_api_key_masked: string | null
}

export interface ApifySettingsOut {
  actor_id: string
}

export interface ApifyAccountOut {
  id: number
  label: string
  api_token_masked: string | null
  priority: number
  is_active: boolean
  last_used_at: string | null
  last_error: string | null
  last_error_at: string | null
}

export interface ScraperSettingsOut {
  provider: string
  available_providers: string[]
  bright_data_api_key_masked: string | null
  bright_data_enrichment_enabled: boolean
  scrape_creators_api_key_masked: string | null
  incompatible_filter_names: string[]
}

export interface NotificationSettingsOut {
  discord_enabled: boolean
  discord_webhook_url_masked: string | null
  telegram_enabled: boolean
  telegram_bot_token_masked: string | null
  telegram_chat_id: string | null
  notification_score_threshold: number
}

export interface AppSettingsOut {
  llm: LLMSettingsOut
  apify: ApifySettingsOut
  scraper: ScraperSettingsOut
  notifications: NotificationSettingsOut
}

export interface SearchFilterOut {
  id: number
  name: string
  is_active: boolean
  search_mode: 'url' | 'location'
  search_url: string | null
  location: string | null
  query: string | null
  min_price: number | null
  max_price: number | null
  radius_miles: number | null
  days_listed: number | null
  condition: string | null
  results_limit: number
  criteria_profile_id: number | null
  sort_by: string | null
  delivery_method: string | null
  availability: string | null
  latitude: number | null
  longitude: number | null
}

export interface CriteriaProfileIn {
  name: string
  prompt_text: string
  weights?: Record<string, unknown>
  is_active?: boolean
}

export interface CriteriaProfileOut extends CriteriaProfileIn {
  id: number
  version: number
  created_at: string
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

export interface ApifyAccountUsageOut {
  account_id: number
  label: string
  used_usd: number | null
  limit_usd: number | null
  cycle_start: string | null
  cycle_end: string | null
  error: string | null
}

export interface ScrapeCreatorsUsageOut {
  configured: boolean
  credits_remaining: number | null
  credits_used_today: number | null
  requests_today: number | null
  error: string | null
}

export interface BrightDataUsageOut {
  configured: boolean
  balance_usd: number | null
  pending_balance_usd: number | null
  error: string | null
}

export interface LLMProviderUsageOut {
  provider: string
  model: string
  scored_count: number
  priced_count: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number | null
}

export interface UsageOut {
  apify: ApifyAccountUsageOut[]
  scrape_creators: ScrapeCreatorsUsageOut
  bright_data: BrightDataUsageOut
  llm_this_month: LLMProviderUsageOut[]
  llm_all_time: LLMProviderUsageOut[]
}

export type ConnectionStatus = 'connected' | 'error' | 'not_configured'

export interface LLMStatusOut {
  provider: string
  configured: boolean
  status: ConnectionStatus
  error: string | null
}

export interface ScraperStatusOut {
  provider: string
  configured: boolean
  status: ConnectionStatus
  error: string | null
  label: string | null
}

export interface SystemStatusOut {
  llm: LLMStatusOut[]
  scrapers: ScraperStatusOut[]
}

export interface LogEntryOut {
  id: number
  created_at: string
  level: string
  logger_name: string
  message: string
}

export interface LogsOut {
  logs: LogEntryOut[]
  last_id: number
}
