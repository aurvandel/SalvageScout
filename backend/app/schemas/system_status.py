from pydantic import BaseModel


class LLMStatusOut(BaseModel):
    provider: str
    configured: bool
    status: str  # "connected" | "error" | "not_configured"
    error: str | None = None


class ScraperStatusOut(BaseModel):
    provider: str
    configured: bool
    status: str  # "connected" | "error" | "not_configured"
    error: str | None = None


class SystemStatusOut(BaseModel):
    llm: list[LLMStatusOut]
    scrapers: list[ScraperStatusOut]


class LogEntryOut(BaseModel):
    id: int
    created_at: str
    level: str
    logger_name: str
    message: str


class LogsOut(BaseModel):
    logs: list[LogEntryOut]
    last_id: int
