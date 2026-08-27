import pytest

from app.models import AppSettings, ApifyAccount, SearchFilter
from app.scraper.apify_backend import fetch_listings
from app.scraper.apify_client import ApifyFailoverError, CURIOUS_CODER_ACTOR_ID


def _make_account(db, label="acct", token="fake-token", priority=100, is_active=True):
    account = ApifyAccount(label=label, api_token=token, priority=priority, is_active=is_active)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def test_fetch_listings_builds_url_fetches_and_normalizes(db, raw_listings, mocker):
    account = _make_account(db)
    mocker.patch(
        "app.scraper.apify_backend.fetch_listings_with_failover",
        return_value=(raw_listings, account.id, [(account.id, None)]),
    )

    sf = SearchFilter(name="test", search_mode="url", search_url="https://www.facebook.com/marketplace/x/search/")
    config = AppSettings(apify_actor_id="apify/facebook-marketplace-scraper")

    items = fetch_listings(db, sf, 10, config)

    assert len(items) == 3
    assert items[0]["title"]
    assert "photo_urls" in items[0]
    assert "raw_scraper_data" in items[0]


def test_fetch_listings_passes_active_accounts_and_actor_id(db, mocker):
    account = _make_account(db, token="fake-token")
    mock_fetch = mocker.patch(
        "app.scraper.apify_backend.fetch_listings_with_failover",
        return_value=([], account.id, [(account.id, None)]),
    )
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_actor_id="custom/actor")

    fetch_listings(db, sf, 5, config)

    mock_fetch.assert_called_once_with(
        "https://example.com/search", 5, [(account.id, "fake-token")], actor_id="custom/actor"
    )


def test_fetch_listings_excludes_inactive_accounts(db, mocker):
    active = _make_account(db, label="active", token="active-token")
    _make_account(db, label="inactive", token="inactive-token", is_active=False)
    mock_fetch = mocker.patch(
        "app.scraper.apify_backend.fetch_listings_with_failover",
        return_value=([], active.id, [(active.id, None)]),
    )
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_actor_id="apify/facebook-marketplace-scraper")

    fetch_listings(db, sf, 5, config)

    mock_fetch.assert_called_once_with(
        "https://example.com/search", 5, [(active.id, "active-token")], actor_id="apify/facebook-marketplace-scraper"
    )


def test_fetch_listings_uses_curious_coder_normalizer(db, mocker):
    account = _make_account(db)
    raw = {"id": "123", "marketplace_listing_title": "2020 Toyota Corolla"}
    mocker.patch(
        "app.scraper.apify_backend.fetch_listings_with_failover",
        return_value=([raw], account.id, [(account.id, None)]),
    )
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_actor_id=CURIOUS_CODER_ACTOR_ID)

    items = fetch_listings(db, sf, 5, config)

    assert items[0]["fb_listing_id"] == "123"
    assert items[0]["url"] == "https://www.facebook.com/marketplace/item/123/"


def test_fetch_listings_raises_when_no_active_accounts(db, mocker):
    mocker.patch("app.settings_service.env_settings.apify_token", None)
    _make_account(db, is_active=False)
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_actor_id="apify/facebook-marketplace-scraper")

    with pytest.raises(RuntimeError, match="No active Apify accounts"):
        fetch_listings(db, sf, 5, config)


def test_fetch_listings_records_last_used_and_last_error(db, mocker):
    account1 = _make_account(db, label="a", priority=1)
    account2 = _make_account(db, label="b", priority=2)
    mocker.patch(
        "app.scraper.apify_backend.fetch_listings_with_failover",
        return_value=([], account2.id, [(account1.id, "boom"), (account2.id, None)]),
    )
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_actor_id="apify/facebook-marketplace-scraper")

    fetch_listings(db, sf, 5, config)

    db.refresh(account1)
    db.refresh(account2)
    assert account1.last_error == "boom"
    assert account1.last_error_at is not None
    assert account2.last_used_at is not None
    assert account2.last_error is None


def test_fetch_listings_records_last_error_when_all_accounts_fail(db, mocker):
    account1 = _make_account(db, label="a", priority=1)
    account2 = _make_account(db, label="b", priority=2)
    mocker.patch(
        "app.scraper.apify_backend.fetch_listings_with_failover",
        side_effect=ApifyFailoverError("all failed", [(account1.id, "boom 1"), (account2.id, "boom 2")]),
    )
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_actor_id="apify/facebook-marketplace-scraper")

    with pytest.raises(ApifyFailoverError):
        fetch_listings(db, sf, 5, config)

    db.refresh(account1)
    db.refresh(account2)
    assert account1.last_error == "boom 1"
    assert account1.last_error_at is not None
    assert account2.last_error == "boom 2"
    assert account2.last_error_at is not None
