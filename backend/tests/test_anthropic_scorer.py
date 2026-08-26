from unittest.mock import MagicMock

import pytest

from app.models import CriteriaProfile, Listing
from app.scorer.anthropic_scorer import DEFAULT_MODEL, score_listing
from app.scorer.schemas import ScoreResult


def _listing():
    return Listing(
        fb_listing_id="1",
        url="https://example.com",
        title="2014 Chevrolet Impala",
        price_amount=2500.0,
        raw_scraper_data={},
    )


def _criteria_profile():
    return CriteriaProfile(name="default", prompt_text="Score this car for a budget beater search.")


def test_score_listing_calls_parse_with_expected_args(mocker):
    expected = ScoreResult(match_score=80, summary="Solid budget car.", pros=["Cheap"], cons=["High mileage"], dealbreaker_flags=[])
    mock_client = MagicMock()
    mock_client.messages.parse.return_value = MagicMock(
        parsed_output=expected, usage=MagicMock(input_tokens=200, output_tokens=60)
    )
    mocker.patch("app.scorer.anthropic_scorer.anthropic.Anthropic", return_value=mock_client)

    result, usage = score_listing(_listing(), _criteria_profile(), api_key="fake-anthropic-key")

    assert result == expected
    assert usage.input_tokens == 200
    assert usage.output_tokens == 60
    call_kwargs = mock_client.messages.parse.call_args.kwargs
    assert call_kwargs["model"] == DEFAULT_MODEL
    assert call_kwargs["system"] == "Score this car for a budget beater search."
    assert call_kwargs["output_format"] is ScoreResult
    assert "2014 Chevrolet Impala" in call_kwargs["messages"][0]["content"]


def test_score_listing_with_custom_model(mocker):
    expected = ScoreResult(match_score=75, summary="Good deal.", pros=["Reliable"], cons=["Expensive"], dealbreaker_flags=[])
    mock_client = MagicMock()
    mock_client.messages.parse.return_value = MagicMock(
        parsed_output=expected, usage=MagicMock(input_tokens=180, output_tokens=55)
    )
    mocker.patch("app.scorer.anthropic_scorer.anthropic.Anthropic", return_value=mock_client)

    result, _usage = score_listing(_listing(), _criteria_profile(), model="claude-opus-4-1", api_key="fake-anthropic-key")

    assert result == expected
    call_kwargs = mock_client.messages.parse.call_args.kwargs
    assert call_kwargs["model"] == "claude-opus-4-1"


def test_score_listing_raises_when_api_key_missing():
    with pytest.raises(RuntimeError, match="Anthropic API key"):
        score_listing(_listing(), _criteria_profile(), api_key=None)
