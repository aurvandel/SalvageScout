from pydantic import BaseModel


class ApifyUsageOut(BaseModel):
    configured: bool
    used_usd: float | None = None
    limit_usd: float | None = None
    cycle_start: str | None = None
    cycle_end: str | None = None
    error: str | None = None


class LLMProviderUsageOut(BaseModel):
    provider: str
    model: str
    scored_count: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float | None


class UsageOut(BaseModel):
    apify: ApifyUsageOut
    llm_this_month: list[LLMProviderUsageOut]
    llm_all_time: list[LLMProviderUsageOut]
