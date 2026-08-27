from app.models import AppSettings, SearchFilter
from app.scraper.apify_backend import fetch_listings
from app.scraper.apify_client import CURIOUS_CODER_ACTOR_ID


def test_fetch_listings_builds_url_fetches_and_normalizes(db, raw_listings, mocker):
    mocker.patch("app.scraper.apify_backend.fetch_from_apify", return_value=raw_listings)

    sf = SearchFilter(name="test", search_mode="url", search_url="https://www.facebook.com/marketplace/x/search/")
    config = AppSettings(apify_token="fake-token", apify_actor_id="apify/facebook-marketplace-scraper")

    items = fetch_listings(db, sf, 10, config)

    assert len(items) == 3
    assert items[0]["title"]
    assert "photo_urls" in items[0]
    assert "raw_scraper_data" in items[0]


def test_fetch_listings_passes_token_and_actor_id(db, mocker):
    mock_fetch = mocker.patch("app.scraper.apify_backend.fetch_from_apify", return_value=[])
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_token="fake-token", apify_actor_id="custom/actor")

    fetch_listings(db, sf, 5, config)

    mock_fetch.assert_called_once_with(
        "https://example.com/search", 5, apify_token="fake-token", actor_id="custom/actor"
    )


def test_fetch_listings_uses_curious_coder_normalizer(db, mocker):
    raw = {"id": "123", "marketplace_listing_title": "2020 Toyota Corolla"}
    mocker.patch("app.scraper.apify_backend.fetch_from_apify", return_value=[raw])
    sf = SearchFilter(name="test", search_mode="url", search_url="https://example.com/search")
    config = AppSettings(apify_token="fake-token", apify_actor_id=CURIOUS_CODER_ACTOR_ID)

    items = fetch_listings(db, sf, 5, config)

    assert items[0]["fb_listing_id"] == "123"
    assert items[0]["url"] == "https://www.facebook.com/marketplace/item/123/"
