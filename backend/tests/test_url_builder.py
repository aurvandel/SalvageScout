import pytest

from app.models import SearchFilter
from app.scraper.url_builder import build_search_url


def test_url_mode_returns_search_url_verbatim():
    sf = SearchFilter(id=1, name="x", search_mode="url", search_url="https://example.com/search?query=sedan")
    assert build_search_url(sf) == "https://example.com/search?query=sedan"


def test_url_mode_raises_without_search_url():
    sf = SearchFilter(id=1, name="x", search_mode="url", search_url=None)
    with pytest.raises(ValueError, match="URL mode"):
        build_search_url(sf)


def test_location_mode_builds_base_url_with_no_filters():
    sf = SearchFilter(id=1, name="x", search_mode="location", location="newyork")
    assert build_search_url(sf) == "https://www.facebook.com/marketplace/newyork/search/"


def test_location_mode_appends_query_params():
    sf = SearchFilter(
        id=1,
        name="x",
        search_mode="location",
        location="newyork",
        query="sedan",
        min_price=1000,
        max_price=5000,
        radius_miles=25,
        days_listed=7,
        condition="used",
    )
    url = build_search_url(sf)
    assert url.startswith("https://www.facebook.com/marketplace/newyork/search/?")
    assert "query=sedan" in url
    assert "minPrice=1000" in url
    assert "maxPrice=5000" in url
    assert "radius=25" in url
    assert "daysSinceListed=7" in url
    assert "itemCondition=used" in url


def test_location_mode_raises_without_location():
    sf = SearchFilter(id=1, name="x", search_mode="location", location=None)
    with pytest.raises(ValueError, match="location mode"):
        build_search_url(sf)
