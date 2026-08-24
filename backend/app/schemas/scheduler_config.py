from datetime import datetime
from pydantic import BaseModel, Field


class SchedulerConfigIn(BaseModel):
    is_enabled: bool = True
    run_hour: int = Field(..., ge=0, le=23)
    run_minute: int = Field(..., ge=0, le=59)


class SchedulerConfigOut(BaseModel):
    id: int
    is_enabled: bool
    run_hour: int
    run_minute: int
    updated_at: datetime

    class Config:
        from_attributes = True
