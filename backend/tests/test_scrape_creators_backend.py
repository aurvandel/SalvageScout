import httpx
import pytest
import respx

from app.models import AppSettings, SearchFilter
from app.scraper.scrape_creators_backend import fetch_listings

LOCATION_RESPONSE = {
    "success": True,
    # Real responses mix same-named cities/neighborhoods; e.g. querying "Austin"
    # returns "Austin, IL" (a Chicago suburb, subtitle "Austin, IL · ...") before
    # "Austin, Texas" (subtitle "City") — confirmed via a live call. This fixture
    # keeps both to guard the picking logic, not just the happy path.
    "locations": [
        {"name": "Austin", "subtitle": "Austin, IL · 22,886 people checked in here", "latitude": 41.894086, "longitude": -87.763202, "city": "Chicago"},
        {"name": "Austin, Texas", "subtitle": "City", "latitude": 30.2677, "longitude": -97.7475, "city": "Austin"},
    ],
}

SEARCH_RESPONSE = {
    "success": True,
    "listings": [
        {
            "id": "123",
            "url": "https://www.facebook.com/marketplace/item/123",
            "title": "2018 Mercedes-Benz C 300 Convertible 27k miles",
            "price": {"amount": 35995, "formatted_amount": "$35,995"},
            "location": {"city": "Austin", "state": "TX", "display_name": "Austin, TX"},
            "primary_photo": {"id": "p1", "url": "https://img.example.com/1.jpg"},
            "is_live": True,
            "is_pending": False,
            "is_sold": False,
        }
    ],
    "cursor": None,
    "has_next_page": False,
}

ITEM_RESPONSE = {
    # Shape confirmed via a live call: `condition` and `mileage` are flat/structured
    # fields on the detail response, not entries in `attributes` (which was empty).
    "id": "123",
    "url": "https://www.facebook.com/marketplace/item/123",
    "title": "2018 Mercedes-Benz C 300 Convertible 27k miles",
    "description": "Great car, one owner.",
    "creation_time": "2026-04-02T11:25:00.000Z",
    "location_text": "Austin, TX",
    "location": {"latitude": 30.27, "longitude": -97.74},
    "price": {"amount": 35995, "currency": "USD"},
    "strikethrough_price": None,
    "condition": "USED",
    "attributes": [],
    "mileage": {"formatted": "27,000 miles", "value": 27000, "unit": "miles"},
    "photos": [{"id": "p1", "url": "https://img.example.com/1.jpg"}, {"id": "p2", "url": "https://img.example.com/2.jpg"}],
    "is_live": True,
    "is_pending": False,
    "is_sold": False,
}

# Real-world case (confirmed live): titles often carry no inline mileage text at
# all — mileage rides only in the structured `mileage` field on the detail response.
NO_TITLE_MILEAGE_ITEM_RESPONSE = {
    **ITEM_RESPONSE,
    "id": "456",
    "url": "https://www.facebook.com/marketplace/item/456",
    "title": "1995 Ford F-150 · XLT Pickup 2D 6 1/2 ft",
    "mileage": {"formatted": "250,000 miles", "value": 250000, "unit": "miles"},
}


def _search_filter(db, **kwargs):
    sf = SearchFilter(name="test", search_mode="location", location="austin", query="sedan", **kwargs)
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def _config():
    return AppSettings(scrape_creators_api_key="fake-key")


@respx.mock
def test_fetch_listings_geocodes_caches_and_normalizes(db):
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(db)
    items = fetch_listings(db, sf, 10, _config())

    assert len(items) == 1
    item = items[0]
    assert item["fb_listing_id"] == "123"
    assert item["description"] == "Great car, one owner."
    assert item["condition"] == "USED"
    assert item["mileage"] == 27000
    assert item["make"] == "Mercedes-Benz"
    assert item["photo_urls"] == ["https://img.example.com/1.jpg", "https://img.example.com/2.jpg"]
    assert item["latitude"] == 30.27

    db.refresh(sf)
    assert float(sf.latitude) == pytest.approx(30.2677)
    assert float(sf.longitude) == pytest.approx(-97.7475)


@respx.mock
def test_fetch_listings_uses_detail_mileage_when_title_has_none(db):
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(
            200,
            json={
                **SEARCH_RESPONSE,
                "listings": [
                    {**SEARCH_RESPONSE["listings"][0], "id": "456", "title": "1995 Ford F-150 · XLT Pickup 2D 6 1/2 ft"}
                ],
            },
        )
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=NO_TITLE_MILEAGE_ITEM_RESPONSE)
    )

    sf = _search_filter(db)
    items = fetch_listings(db, sf, 10, _config())

    assert items[0]["mileage"] == 250000


@respx.mock
def test_fetch_listings_skips_geocoding_when_already_cached(db):
    location_route = respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(db, latitude=30.2677, longitude=-97.7475)
    fetch_listings(db, sf, 10, _config())

    assert not location_route.called


def test_fetch_listings_raises_without_api_key(db):
    sf = _search_filter(db)
    with pytest.raises(RuntimeError, match="ScrapeCreators"):
        fetch_listings(db, sf, 10, AppSettings())


@respx.mock
def test_fetch_listings_raises_when_location_not_found(db):
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json={"success": True, "locations": []})
    )

    sf = _search_filter(db)
    with pytest.raises(ValueError, match="no location match"):
        fetch_listings(db, sf, 10, _config())
