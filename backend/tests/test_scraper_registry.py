import pytest

from app.scraper.apify_backend import fetch_listings as apify_fetch_listings
from app.scraper.registry import get_available_scraper_providers, get_scraper, supports_search_mode


def test_get_scraper_returns_apify_implementation():
    assert get_scraper("apify") is apify_fetch_listings


def test_get_scraper_unknown_provider_raises():
    with pytest.raises(ValueError, match="slack"):
        get_scraper("slack")


def test_get_available_scraper_providers():
    # Bright Data isn't here — its scraper is item-detail only and can't
    # discover listings from a SearchFilter (see registry.py).
    assert get_available_scraper_providers() == ["apify", "scrape_creators"]


def test_supports_search_mode_url_only_for_apify():
    assert supports_search_mode("apify", "url") is True
    assert supports_search_mode("scrape_creators", "url") is False


def test_supports_search_mode_location_for_all_providers():
    for provider in get_available_scraper_providers():
        assert supports_search_mode(provider, "location") is True
