from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CriteriaProfileIn(BaseModel):
    name: str
    prompt_text: str
    weights: dict = {}
    is_active: bool = True


class CriteriaProfileOut(CriteriaProfileIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version: int
    created_at: datetime
