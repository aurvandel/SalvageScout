from pydantic import BaseModel, Field


class ScoreResult(BaseModel):
    match_score: int = Field(ge=0, le=100)
    summary: str
    pros: list[str]
    cons: list[str]
    dealbreaker_flags: list[str]


class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
