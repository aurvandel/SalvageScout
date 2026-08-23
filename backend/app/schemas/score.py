from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    match_score: int
    summary: str
    pros: list[str]
    cons: list[str]
    dealbreaker_flags: list[str]
    model_used: str
    created_at: datetime
