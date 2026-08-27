import anthropic

from app.models import CriteriaProfile, Listing
from app.scorer.base import build_listing_text
from app.scorer.schemas import ScoreResult, TokenUsage

AVAILABLE_MODELS = ["claude-haiku-4-5", "claude-opus-4-1", "claude-sonnet-4"]
DEFAULT_MODEL = "claude-haiku-4-5"


def score_listing(
    listing: Listing, criteria_profile: CriteriaProfile, model: str = DEFAULT_MODEL, api_key: str | None = None
) -> tuple[ScoreResult, TokenUsage]:
    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown Anthropic model: {model}. Available: {AVAILABLE_MODELS}")
    if not api_key:
        raise RuntimeError("Anthropic API key is not configured")

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.parse(
        model=model,
        max_tokens=2048,
        system=criteria_profile.prompt_text,
        messages=[{"role": "user", "content": build_listing_text(listing)}],
        output_format=ScoreResult,
    )
    usage = TokenUsage(input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens)
    return response.parsed_output, usage


def check_connection(api_key: str) -> None:
    """Raises if the key is invalid or Anthropic is unreachable. Lists models
    instead of scoring — costs no tokens."""
    client = anthropic.Anthropic(api_key=api_key, timeout=5.0)
    client.models.list(limit=1)
