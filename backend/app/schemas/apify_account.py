from datetime import datetime

from pydantic import BaseModel


class ApifyAccountIn(BaseModel):
    # Both optional so PATCH can send a partial body (e.g. just is_active from
    # the inline toggle) — create() enforces label/api_token are present.
    label: str | None = None
    api_token: str | None = None  # omitted on update to keep the existing token
    priority: int = 100
    is_active: bool = True


class ApifyAccountOut(BaseModel):
    id: int
    label: str
    api_token_masked: str | None
    priority: int
    is_active: bool
    last_used_at: datetime | None
    last_error: str | None
    last_error_at: datetime | None
