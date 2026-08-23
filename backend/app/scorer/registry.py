from app.scorer import anthropic_scorer
from app.scorer.base import Scorer

_SCORERS: dict[str, Scorer] = {
    "anthropic": anthropic_scorer.score_listing,
}

_MODEL_NAMES: dict[str, str] = {
    "anthropic": anthropic_scorer.MODEL,
}


def get_scorer(provider: str) -> Scorer:
    try:
        return _SCORERS[provider]
    except KeyError:
        raise ValueError(f"Unknown LLM provider {provider!r}. Available: {sorted(_SCORERS)}") from None


def get_model_name(provider: str) -> str:
    try:
        return _MODEL_NAMES[provider]
    except KeyError:
        raise ValueError(f"Unknown LLM provider {provider!r}. Available: {sorted(_MODEL_NAMES)}") from None
