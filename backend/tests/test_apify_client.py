from decimal import Decimal

import pytest
from unittest.mock import MagicMock

from apify_client.errors import ApifyApiError

from app.scraper.apify_client import (
    ACTOR_ID,
    CURIOUS_CODER_ACTOR_ID,
    ApifyFailoverError,
    ApifyRunFailedError,
    fetch_listings,
    fetch_listings_with_failover,
    get_account_usage,
)


def _make_apify_api_error(status_code: int) -> ApifyApiError:
    response = MagicMock(status_code=status_code, text="error", json=MagicMock(return_value={}))
    return ApifyApiError(response, 1)


def test_fetch_listings_calls_actor_with_expected_input(mocker):
    mock_client = MagicMock()
    mock_run = MagicMock(default_dataset_id="dataset123", status="SUCCEEDED")
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
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d", status="SUCCEEDED")
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    fetch_listings("https://example.com", results_limit=5, include_details=False, apify_token="fake-token")

    call_kwargs = mock_client.actor.return_value.call.call_args.kwargs
    assert call_kwargs["run_input"]["includeListingDetails"] is False


def test_fetch_listings_uses_custom_actor_id(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d", status="SUCCEEDED")
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    fetch_listings("https://example.com", results_limit=5, apify_token="fake-token", actor_id="custom/actor")

    mock_client.actor.assert_called_once_with("custom/actor")


def test_fetch_listings_uses_curious_coder_input_shape(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d", status="SUCCEEDED")
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


def test_fetch_listings_raises_when_run_not_succeeded(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(
        default_dataset_id="d", status="ABORTED", status_message="Not enough usage credits"
    )
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    with pytest.raises(ApifyRunFailedError, match="ABORTED"):
        fetch_listings("https://example.com", results_limit=5, apify_token="fake-token")


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


def test_fetch_listings_with_failover_succeeds_on_first_account(mocker):
    mock_fetch = mocker.patch("app.scraper.apify_client.fetch_listings", return_value=[{"id": "1"}])

    items, account_id, attempts = fetch_listings_with_failover(
        "https://example.com", 10, [(1, "token-a"), (2, "token-b")]
    )

    assert items == [{"id": "1"}]
    assert account_id == 1
    assert attempts == [(1, None)]
    mock_fetch.assert_called_once()


def test_fetch_listings_with_failover_tries_next_account_on_auth_error(mocker):
    mocker.patch(
        "app.scraper.apify_client.fetch_listings", side_effect=[_make_apify_api_error(401), [{"id": "2"}]]
    )

    items, account_id, attempts = fetch_listings_with_failover(
        "https://example.com", 10, [(1, "token-a"), (2, "token-b")]
    )

    assert items == [{"id": "2"}]
    assert account_id == 2
    assert attempts[0][0] == 1 and attempts[0][1] is not None
    assert attempts[1] == (2, None)


def test_fetch_listings_with_failover_tries_next_account_on_rate_limit(mocker):
    mocker.patch(
        "app.scraper.apify_client.fetch_listings", side_effect=[_make_apify_api_error(429), [{"id": "2"}]]
    )

    _items, account_id, _attempts = fetch_listings_with_failover(
        "https://example.com", 10, [(1, "token-a"), (2, "token-b")]
    )

    assert account_id == 2


def test_fetch_listings_with_failover_tries_next_account_on_run_failed(mocker):
    mocker.patch(
        "app.scraper.apify_client.fetch_listings",
        side_effect=[ApifyRunFailedError("ABORTED", "insufficient funds"), [{"id": "2"}]],
    )

    _items, account_id, attempts = fetch_listings_with_failover(
        "https://example.com", 10, [(1, "token-a"), (2, "token-b")]
    )

    assert account_id == 2
    assert "ABORTED" in attempts[0][1]


def test_fetch_listings_with_failover_does_not_fail_over_on_bad_request(mocker):
    mock_fetch = mocker.patch("app.scraper.apify_client.fetch_listings", side_effect=_make_apify_api_error(400))

    with pytest.raises(ApifyFailoverError) as exc_info:
        fetch_listings_with_failover("https://example.com", 10, [(1, "token-a"), (2, "token-b")])

    mock_fetch.assert_called_once()
    # Only account 1 was attempted (fail-fast), but its outcome is still
    # recorded so the caller can write back last_error for it.
    assert exc_info.value.attempts[0][0] == 1
    assert exc_info.value.attempts[0][1] is not None
    assert len(exc_info.value.attempts) == 1


def test_fetch_listings_with_failover_raises_when_all_accounts_fail(mocker):
    mocker.patch("app.scraper.apify_client.fetch_listings", side_effect=_make_apify_api_error(401))

    with pytest.raises(ApifyFailoverError, match="All 2 configured Apify account") as exc_info:
        fetch_listings_with_failover("https://example.com", 10, [(1, "token-a"), (2, "token-b")])

    assert [account_id for account_id, _ in exc_info.value.attempts] == [1, 2]


def test_fetch_listings_with_failover_raises_when_no_accounts():
    with pytest.raises(RuntimeError, match="No Apify accounts"):
        fetch_listings_with_failover("https://example.com", 10, [])
