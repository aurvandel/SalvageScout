from pydantic import BaseModel


class ApifyAccountUsageOut(BaseModel):
    account_id: int
    label: str
    used_usd: float | None = None
    limit_usd: float | None = None
    cycle_start: str | None = None
    cycle_end: str | None = None
    error: str | None = None


class ScrapeCreatorsUsageOut(BaseModel):
    configured: bool
    credits_remaining: int | None = None
    credits_used_today: int | None = None
    requests_today: int | None = None
    error: str | None = None


class BrightDataUsageOut(BaseModel):
    configured: bool
    balance_usd: float | None = None
    pending_balance_usd: float | None = None
    error: str | None = None


class LLMProviderUsageOut(BaseModel):
    provider: str
    model: str
    scored_count: int
    priced_count: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float | None


class UsageOut(BaseModel):
    apify: list[ApifyAccountUsageOut]
    scrape_creators: ScrapeCreatorsUsageOut
    bright_data: BrightDataUsageOut
    llm_this_month: list[LLMProviderUsageOut]
    llm_all_time: list[LLMProviderUsageOut]
