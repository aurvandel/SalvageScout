import json

import google.generativeai as genai

from app.models import CriteriaProfile, Listing
from app.scorer.base import build_listing_text
from app.scorer.schemas import ScoreResult, TokenUsage

AVAILABLE_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
DEFAULT_MODEL = "gemini-2.0-flash"


def score_listing(
    listing: Listing, criteria_profile: CriteriaProfile, model: str = DEFAULT_MODEL, api_key: str | None = None
) -> tuple[ScoreResult, TokenUsage]:
    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown Gemini model: {model}. Available: {AVAILABLE_MODELS}")
    if not api_key:
        raise RuntimeError("Gemini API key is not configured")

    genai.configure(api_key=api_key)
    client = genai.GenerativeModel(model)

    schema = {
        "type": "object",
        "properties": {
            "match_score": {"type": "integer", "minimum": 0, "maximum": 100},
            "summary": {"type": "string"},
            "pros": {"type": "array", "items": {"type": "string"}},
            "cons": {"type": "array", "items": {"type": "string"}},
            "dealbreaker_flags": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["match_score", "summary", "pros", "cons", "dealbreaker_flags"],
    }

    response = client.generate_content(
        [
            {"role": "user", "parts": [{"text": criteria_profile.prompt_text}]},
            {"role": "user", "parts": [{"text": build_listing_text(listing)}]},
        ],
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            response_schema=schema,
            max_output_tokens=2048,
        ),
    )

    result_dict = json.loads(response.text)
    usage = TokenUsage(
        input_tokens=response.usage_metadata.prompt_token_count,
        output_tokens=response.usage_metadata.candidates_token_count,
    )
    return ScoreResult(**result_dict), usage


def check_connection(api_key: str) -> None:
    """Raises if the key is invalid or Gemini is unreachable. Lists models
    instead of scoring — costs no tokens. list_models() is lazy, so next()
    is what actually forces the HTTP call."""
    genai.configure(api_key=api_key)
    next(iter(genai.list_models(request_options={"timeout": 5})))
