import pytest

from app.scorer.anthropic_scorer import score_listing as anthropic_score_listing
from app.scorer.registry import get_model_name, get_scorer


def test_get_scorer_returns_anthropic_implementation():
    assert get_scorer("anthropic") is anthropic_score_listing


def test_get_scorer_unknown_provider_raises():
    with pytest.raises(ValueError, match="openai"):
        get_scorer("openai")


def test_get_model_name_returns_haiku():
    assert get_model_name("anthropic") == "claude-haiku-4-5"


def test_get_model_name_unknown_provider_raises():
    with pytest.raises(ValueError, match="gemini"):
        get_model_name("gemini")
