from decimal import Decimal

import pytest
from unittest.mock import MagicMock

from app.scraper.apify_client import CURIOUS_CODER_ACTOR_ID, ACTOR_ID, fetch_listings, get_account_usage


def test_fetch_listings_calls_actor_with_expected_input(mocker):
    mock_client = MagicMock()
    mock_run = MagicMock(default_dataset_id="dataset123")
    mock_client.actor.return_value.call.return_value = mock_run
    mock_client.dataset.return_value.iterate_items.return_value = iter([{"id": "1"}, {"id": "2"}])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    result = fetch_listings(
        "https://www.facebook.com/marketplace/x/search/?query=sedan", results_limit=10, apify_token="fake-token"
    )

    mock_client.actor.assert_called_once_with(ACTOR_ID)
    mock_client.actor.return_value.call.assert_called_once_with(
        run_input={
            "startUrls": [{"url": "https://www.facebook.com/marketplace/x/search/?query=sedan"}],
            "resultsLimit": 10,
            "includeListingDetails": True,
        }
    )
    mock_client.dataset.assert_called_once_with("dataset123")
    assert result == [{"id": "1"}, {"id": "2"}]


def test_fetch_listings_can_disable_details(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d")
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    fetch_listings("https://example.com", results_limit=5, include_details=False, apify_token="fake-token")

    call_kwargs = mock_client.actor.return_value.call.call_args.kwargs
    assert call_kwargs["run_input"]["includeListingDetails"] is False


def test_fetch_listings_uses_custom_actor_id(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d")
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    fetch_listings("https://example.com", results_limit=5, apify_token="fake-token", actor_id="custom/actor")

    mock_client.actor.assert_called_once_with("custom/actor")


def test_fetch_listings_uses_curious_coder_input_shape(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d")
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    fetch_listings(
        "https://www.facebook.com/marketplace/x/search/?query=sedan",
        results_limit=10,
        apify_token="fake-token",
        actor_id=CURIOUS_CODER_ACTOR_ID,
    )

    call_kwargs = mock_client.actor.return_value.call.call_args.kwargs
    assert call_kwargs["run_input"] == {
        "urls": ["https://www.facebook.com/marketplace/x/search/?query=sedan"],
        "getListingDetails": True,
        "getAllListingPhotos": True,
    }
    assert call_kwargs["max_items"] == 10
    assert call_kwargs["max_total_charge_usd"] == Decimal(10) * Decimal("0.002") + Decimal("0.05")


def test_fetch_listings_raises_when_token_missing():
    with pytest.raises(RuntimeError, match="Apify token"):
        fetch_listings("https://example.com", results_limit=5, apify_token=None)


def test_get_account_usage_reads_limits(mocker):
    mock_client = MagicMock()
    mock_client.user.return_value.limits.return_value = MagicMock(
        current=MagicMock(monthly_usage_usd=12.5),
        limits=MagicMock(max_monthly_usage_usd=300.0),
        monthly_usage_cycle=MagicMock(
            start_at=MagicMock(isoformat=lambda: "2026-08-01T00:00:00+00:00"),
            end_at=MagicMock(isoformat=lambda: "2026-08-31T23:59:59+00:00"),
        ),
    )
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    result = get_account_usage("fake-token")

    assert result == {
        "used_usd": 12.5,
        "limit_usd": 300.0,
        "cycle_start": "2026-08-01T00:00:00+00:00",
        "cycle_end": "2026-08-31T23:59:59+00:00",
    }


def test_get_account_usage_raises_when_token_missing():
    with pytest.raises(RuntimeError, match="Apify token"):
        get_account_usage(None)
