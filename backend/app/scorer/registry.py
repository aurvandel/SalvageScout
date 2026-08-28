from app.scorer import anthropic_scorer, gemini_scorer, openai_scorer
from app.scorer.base import Scorer

_SCORERS: dict[str, Scorer] = {
    "anthropic": anthropic_scorer.score_listing,
    "openai": openai_scorer.score_listing,
    "gemini": gemini_scorer.score_listing,
}

_PROVIDER_MODELS: dict[str, list[str]] = {
    "anthropic": ["claude-haiku-4-5", "claude-opus-4-1", "claude-sonnet-4"],
    "openai": openai_scorer.AVAILABLE_MODELS,
    "gemini": gemini_scorer.AVAILABLE_MODELS,
}

_DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-haiku-4-5",
    "openai": openai_scorer.DEFAULT_MODEL,
    "gemini": gemini_scorer.DEFAULT_MODEL,
}

_SCORER_MODULES = {
    "anthropic": anthropic_scorer,
    "openai": openai_scorer,
    "gemini": gemini_scorer,
}


def check_connection(provider: str, api_key: str) -> None:
    try:
        module = _SCORER_MODULES[provider]
    except KeyError:
        raise ValueError(f"Unknown LLM provider {provider!r}. Available: {sorted(_SCORER_MODULES)}") from None
    module.check_connection(api_key)


def get_scorer(provider: str) -> Scorer:
    try:
        return _SCORERS[provider]
    except KeyError:
        raise ValueError(f"Unknown LLM provider {provider!r}. Available: {sorted(_SCORERS)}") from None


def get_available_providers() -> list[str]:
    return sorted(_SCORERS.keys())


def get_available_models(provider: str) -> list[str]:
    if provider not in _PROVIDER_MODELS:
        raise ValueError(f"Unknown LLM provider {provider!r}. Available: {sorted(_PROVIDER_MODELS)}")
    return _PROVIDER_MODELS[provider]


def get_default_model(provider: str) -> str:
    if provider not in _DEFAULT_MODELS:
        raise ValueError(f"Unknown LLM provider {provider!r}. Available: {sorted(_DEFAULT_MODELS)}")
    return _DEFAULT_MODELS[provider]
