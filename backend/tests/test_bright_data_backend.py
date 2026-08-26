import json

import httpx
import pytest
import respx

from app.models import AppSettings, SearchFilter
from app.scraper.bright_data_backend import fetch_listings

# Shape confirmed against Bright Data's own docs (facebook-marketplace-discover-by-url).
SCRAPE_RESPONSE = [
    {
        "url": "https://www.facebook.com/marketplace/item/1259177466401495",
        "title": "2018 Mercedes-Benz C 300 Convertible 27k miles",
        "initial_price": 35995,
        "final_price": 35995,
        "currency": "USD",
        "product_id": "1259177466401495",
        "condition": "USED",
        "description": "1 owner, 2.0 turbo all wheel drive, leather seating pkg.",
        "location": "Knoxville, TN",
        "country_code": "US",
        "images": ["https://img.example.com/1.jpg"],
        "seller_description": "1 owner, 2.0 turbo.",
        "color": "grey",
        "brand": None,
        "videos": None,
        "profile_id": "34591790377134943",
        "listing_date": "2026-04-02T11:25:00.000Z",
    }
]


def _search_filter(db, **kwargs):
    defaults = {"search_mode": "location", "location": "knoxville", "query": "mercedes"}
    defaults.update(kwargs)
    sf = SearchFilter(name="test", **defaults)
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def _config():
    return AppSettings(bright_data_api_key="fake-token")


@respx.mock
def test_fetch_listings_scrapes_and_normalizes(db):
    route = respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        return_value=httpx.Response(200, json=SCRAPE_RESPONSE)
    )

    sf = _search_filter(db)
    items = fetch_listings(db, sf, 10, _config())

    assert len(items) == 1
    item = items[0]
    assert item["fb_listing_id"] == "1259177466401495"
    assert item["price_amount"] == 35995
    assert item["make"] == "Mercedes-Benz"
    assert item["mileage"] == 27000
    assert item["photo_urls"] == ["https://img.example.com/1.jpg"]
    assert item["location_text"] == "Knoxville, TN"

    request = route.calls.last.request
    assert request.url.params["dataset_id"] == "gd_lvt9iwuh6fbcwmx1a"
    body = json.loads(request.content)
    assert body["input"] == [{"url": "https://www.facebook.com/marketplace/knoxville/search/?query=mercedes"}]
    assert body["limit_per_input"] == 10


@respx.mock
def test_fetch_listings_builds_url_from_url_mode_filter(db):
    # Unlike ScrapeCreators, Bright Data's scraper takes a real Marketplace
    # search URL as input, so it can consume search_mode="url" filters directly.
    route = respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        return_value=httpx.Response(200, json=SCRAPE_RESPONSE)
    )

    sf = _search_filter(
        db,
        search_mode="url",
        location=None,
        query=None,
        search_url="https://www.facebook.com/marketplace/austin/search/?query=truck",
    )
    fetch_listings(db, sf, 10, _config())

    body = json.loads(route.calls.last.request.content)
    assert body["input"] == [{"url": "https://www.facebook.com/marketplace/austin/search/?query=truck"}]


def test_fetch_listings_raises_without_api_key(db):
    sf = _search_filter(db)
    with pytest.raises(RuntimeError, match="API key"):
        fetch_listings(db, sf, 10, AppSettings())
