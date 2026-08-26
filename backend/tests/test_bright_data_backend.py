import httpx
import pytest
import respx

from app.models import AppSettings, SearchFilter
from app.scraper.bright_data_backend import fetch_listings

SNAPSHOT_RESPONSE = [
    {
        "product_id": "1259177466401495",
        "url": "https://www.facebook.com/marketplace/item/1259177466401495",
        "title": "2018 Mercedes-Benz C 300 Convertible 27k miles",
        "initial_price": 35995,
        "final_price": 35995,
        "currency": "USD",
        "condition": "USED",
        "description": "1 owner, 2.0 turbo all wheel drive.",
        "location": "Knoxville, TN",
        "images": ["https://img.example.com/1.jpg"],
        "listing_date": "2026-04-02T11:25:00.000Z",
    }
]


def _search_filter(db):
    sf = SearchFilter(name="test", search_mode="location", location="knoxville", query="mercedes")
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def _config():
    return AppSettings(bright_data_api_key="fake-token", bright_data_dataset_id="gd_fake")


@respx.mock
def test_fetch_listings_triggers_polls_and_normalizes(db):
    respx.post("https://api.brightdata.com/datasets/v3/trigger").mock(
        return_value=httpx.Response(200, json={"snapshot_id": "snap123"})
    )
    respx.get("https://api.brightdata.com/datasets/v3/progress/snap123").mock(
        return_value=httpx.Response(200, json={"status": "ready"})
    )
    respx.get("https://api.brightdata.com/datasets/v3/snapshot/snap123").mock(
        return_value=httpx.Response(200, json=SNAPSHOT_RESPONSE)
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


def test_fetch_listings_raises_without_api_key(db):
    sf = _search_filter(db)
    config = AppSettings(bright_data_dataset_id="gd_fake")
    with pytest.raises(RuntimeError, match="API key"):
        fetch_listings(db, sf, 10, config)


def test_fetch_listings_raises_without_dataset_id(db):
    sf = _search_filter(db)
    config = AppSettings(bright_data_api_key="fake-token")
    with pytest.raises(RuntimeError, match="dataset ID"):
        fetch_listings(db, sf, 10, config)


@respx.mock
def test_fetch_listings_raises_when_snapshot_fails(db):
    respx.post("https://api.brightdata.com/datasets/v3/trigger").mock(
        return_value=httpx.Response(200, json={"snapshot_id": "snap123"})
    )
    respx.get("https://api.brightdata.com/datasets/v3/progress/snap123").mock(
        return_value=httpx.Response(200, json={"status": "failed"})
    )

    sf = _search_filter(db)
    with pytest.raises(RuntimeError, match="failed"):
        fetch_listings(db, sf, 10, _config())
