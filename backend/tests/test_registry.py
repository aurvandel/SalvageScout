import pytest

from app.scorer.anthropic_scorer import score_listing as anthropic_score_listing
from app.scorer.registry import get_available_models, get_available_providers, get_default_model, get_scorer


def test_get_scorer_returns_anthropic_implementation():
    assert get_scorer("anthropic") is anthropic_score_listing


def test_get_scorer_unknown_provider_raises():
    with pytest.raises(ValueError, match="slack"):
        get_scorer("slack")


def test_get_available_providers():
    assert get_available_providers() == ["anthropic", "gemini", "openai"]


def test_get_default_model_returns_haiku():
    assert get_default_model("anthropic") == "claude-haiku-4-5"


def test_get_default_model_unknown_provider_raises():
    with pytest.raises(ValueError, match="slack"):
        get_default_model("slack")


def test_get_available_models_unknown_provider_raises():
    with pytest.raises(ValueError, match="slack"):
        get_available_models("slack")
