import pytest

from app.scorer.anthropic_scorer import score_listing as anthropic_score_listing
from app.scorer.registry import (
    check_connection,
    get_available_models,
    get_available_providers,
    get_default_model,
    get_scorer,
)


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


def test_check_connection_dispatches_to_provider(mocker):
    mock_check = mocker.patch("app.scorer.registry.anthropic_scorer.check_connection")

    check_connection("anthropic", "fake-key")

    mock_check.assert_called_once_with("fake-key")


def test_check_connection_propagates_provider_error(mocker):
    mocker.patch("app.scorer.registry.openai_scorer.check_connection", side_effect=RuntimeError("boom"))

    with pytest.raises(RuntimeError, match="boom"):
        check_connection("openai", "fake-key")


def test_check_connection_unknown_provider_raises():
    with pytest.raises(ValueError, match="slack"):
        check_connection("slack", "fake-key")
