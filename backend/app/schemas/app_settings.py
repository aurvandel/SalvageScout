from pydantic import BaseModel


def mask_secret(secret: str | None) -> str | None:
    if not secret:
        return None
    if len(secret) <= 4:
        return "*" * len(secret)
    return "****" + secret[-4:]


class LLMSettingsOut(BaseModel):
    provider: str
    model: str
    available_providers: list[str]
    provider_models: dict[str, list[str]]
    anthropic_api_key_masked: str | None
    openai_api_key_masked: str | None
    gemini_api_key_masked: str | None


class LLMSettingsIn(BaseModel):
    provider: str | None = None
    model: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    gemini_api_key: str | None = None


class ApifySettingsOut(BaseModel):
    actor_id: str
    apify_token_masked: str | None


class ApifySettingsIn(BaseModel):
    actor_id: str | None = None
    apify_token: str | None = None


class ScraperSettingsOut(BaseModel):
    provider: str
    available_providers: list[str]
    bright_data_api_key_masked: str | None
    scrape_creators_api_key_masked: str | None
    # Active search filters that can't be scraped by `provider` (search_mode="url"
    # filters, which only Apify's and Bright Data's backends can consume) —
    # surfaced here so a provider switch doesn't silently stop producing listings
    # for them.
    incompatible_filter_names: list[str]


class ScraperSettingsIn(BaseModel):
    provider: str | None = None
    bright_data_api_key: str | None = None
    scrape_creators_api_key: str | None = None


class NotificationSettingsOut(BaseModel):
    discord_enabled: bool
    discord_webhook_url_masked: str | None
    telegram_enabled: bool
    telegram_bot_token_masked: str | None
    telegram_chat_id: str | None
    notification_score_threshold: int


class NotificationSettingsIn(BaseModel):
    discord_enabled: bool | None = None
    discord_webhook_url: str | None = None
    telegram_enabled: bool | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    notification_score_threshold: int | None = None


class AppSettingsOut(BaseModel):
    llm: LLMSettingsOut
    apify: ApifySettingsOut
    scraper: ScraperSettingsOut
    notifications: NotificationSettingsOut
