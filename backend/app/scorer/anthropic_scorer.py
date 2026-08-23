import anthropic

from app.config import settings
from app.models import CriteriaProfile, Listing
from app.scorer.base import build_listing_text
from app.scorer.schemas import ScoreResult

MODEL = "claude-haiku-4-5"


def score_listing(listing: Listing, criteria_profile: CriteriaProfile) -> ScoreResult:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.parse(
        model=MODEL,
        max_tokens=2048,
        system=criteria_profile.prompt_text,
        messages=[{"role": "user", "content": build_listing_text(listing)}],
        output_format=ScoreResult,
    )
    return response.parsed_output
