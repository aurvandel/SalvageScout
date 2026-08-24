from pydantic import BaseModel


class ArenaRunIn(BaseModel):
    listing_id: int
    criteria_profile_id: int
    providers: list[str]
    models: list[str]


class ArenaScoreResult(BaseModel):
    provider: str
    model: str
    match_score: int
    summary: str
    pros: list[str]
    cons: list[str]
    dealbreaker_flags: list[str]


class ArenaRunOut(BaseModel):
    id: int
    listing_id: int
    criteria_profile_id: int
    providers: list[str]
    models: list[str]
    results: list[ArenaScoreResult]
    created_at: str

    class Config:
        from_attributes = True
