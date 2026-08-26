import json

import openai
from pydantic import TypeAdapter

from app.models import CriteriaProfile, Listing
from app.scorer.base import build_listing_text
from app.scorer.schemas import ScoreResult, TokenUsage

AVAILABLE_MODELS = ["gpt-4-turbo", "gpt-4o", "gpt-4o-mini"]
DEFAULT_MODEL = "gpt-4o-mini"


def score_listing(
    listing: Listing, criteria_profile: CriteriaProfile, model: str = DEFAULT_MODEL, api_key: str | None = None
) -> tuple[ScoreResult, TokenUsage]:
    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown OpenAI model: {model}. Available: {AVAILABLE_MODELS}")
    if not api_key:
        raise RuntimeError("OpenAI API key is not configured")

    client = openai.OpenAI(api_key=api_key)

    json_schema = TypeAdapter(ScoreResult).json_schema()

    response = client.chat.completions.create(
        model=model,
        max_tokens=2048,
        temperature=0,
        messages=[
            {"role": "system", "content": criteria_profile.prompt_text},
            {"role": "user", "content": build_listing_text(listing)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "ScoreResult",
                "schema": json_schema,
                "strict": True,
            },
        },
    )

    result_json = json.loads(response.choices[0].message.content)
    usage = TokenUsage(
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
    )
    return ScoreResult(**result_json), usage
