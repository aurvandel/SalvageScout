from datetime import datetime, timezone

import httpx
import pytest
import respx

from app.models import AppSettings, SearchFilter
from app.scraper.scrape_creators_backend import fetch_listings, get_account_usage

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
def test_fetch_listings_coerces_strikethrough_price_string_to_float(db):
    # Confirmed live: strikethrough_price.amount comes back as a numeric string
    # ("3000.00") while price.amount is a plain int — the Numeric(10, 2) column
    # needs a float/Decimal, not a str.
    item_with_strikethrough = {
        **ITEM_RESPONSE,
        "strikethrough_price": {"formatted_amount": "$40,000", "amount": "40000.00"},
    }
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=item_with_strikethrough)
    )

    sf = _search_filter(db)
    items = fetch_listings(db, sf, 10, _config())

    assert items[0]["strikethrough_price_amount"] == 40000.0
    assert isinstance(items[0]["strikethrough_price_amount"], float)


@respx.mock
def test_fetch_listings_drops_condition_outside_scrapecreators_enum(db):
    # SearchFilter.condition is shared across providers (the admin UI's own
    # placeholder is "used", Apify's convention) but ScrapeCreators only accepts
    # new/used_like_new/used_good/used_fair — confirmed against its live tool
    # schema. A raw "used" must not be forwarded as-is.
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    search_route = respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(db, condition="used")
    fetch_listings(db, sf, 10, _config())

    assert "condition" not in search_route.calls.last.request.url.params


@respx.mock
def test_fetch_listings_passes_through_valid_condition(db):
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    search_route = respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(db, condition="used_good")
    fetch_listings(db, sf, 10, _config())

    assert search_route.calls.last.request.url.params["condition"] == "used_good"


@respx.mock
def test_fetch_listings_passes_through_sort_delivery_availability_and_date_listed(db):
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    search_route = respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(
        db,
        sort_by="Price_Ascend",
        delivery_method="Local_Pickup",
        availability="Available",
        days_listed=7,
    )
    fetch_listings(db, sf, 10, _config())

    params = search_route.calls.last.request.url.params
    assert params["sort_by"] == "price_ascend"
    assert params["delivery_method"] == "local_pickup"
    assert params["availability"] == "available"
    assert params["date_listed"] == "7"


@respx.mock
def test_fetch_listings_drops_invalid_sort_delivery_availability_and_date_listed(db):
    # sort_by/delivery_method/availability are fixed ScrapeCreators enums, and
    # date_listed only accepts the three bucketed values below — days_listed
    # also feeds Apify's free-form `daysSinceListed` URL param (see
    # url_builder.py), so an arbitrary day count must be dropped here rather
    # than forwarded as-is.
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    search_route = respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=SEARCH_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(
        db,
        sort_by="bogus",
        delivery_method="bogus",
        availability="bogus",
        days_listed=14,
    )
    fetch_listings(db, sf, 10, _config())

    params = search_route.calls.last.request.url.params
    assert "sort_by" not in params
    assert "delivery_method" not in params
    assert "availability" not in params
    assert "date_listed" not in params


@respx.mock
def test_fetch_listings_caps_detail_calls_at_results_limit(db):
    # Confirmed live: `count` in the search request is advisory — a call with
    # count=5 came back with 13 listings. Without an explicit slice, results_limit
    # wouldn't bound the (paid, one-per-listing) detail calls at all.
    many_listings = {
        **SEARCH_RESPONSE,
        "listings": [{**SEARCH_RESPONSE["listings"][0], "id": str(i)} for i in range(13)],
    }
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/location/search").mock(
        return_value=httpx.Response(200, json=LOCATION_RESPONSE)
    )
    respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/search").mock(
        return_value=httpx.Response(200, json=many_listings)
    )
    item_route = respx.get("https://api.scrapecreators.com/v1/facebook/marketplace/item").mock(
        return_value=httpx.Response(200, json=ITEM_RESPONSE)
    )

    sf = _search_filter(db)
    items = fetch_listings(db, sf, 5, _config())

    assert len(items) == 5
    assert len(item_route.calls) == 5


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


@respx.mock
def test_get_account_usage_returns_balance_and_todays_usage():
    today = datetime.now(timezone.utc).date().isoformat()
    respx.get("https://api.scrapecreators.com/v1/account/credit-balance").mock(
        return_value=httpx.Response(200, json={"success": True, "creditCount": 97, "message": "You have 97 credits remaining."})
    )
    respx.get("https://api.scrapecreators.com/v1/account/get-daily-usage-count").mock(
        return_value=httpx.Response(
            200, json=[{"usage_date": f"{today}T00:00:00.000Z", "total_credits": "3", "request_count": "3"}]
        )
    )

    result = get_account_usage("fake-key")

    assert result == {"credits_remaining": 97, "credits_used_today": 3, "requests_today": 3}


@respx.mock
def test_get_account_usage_returns_none_for_today_when_no_matching_row():
    respx.get("https://api.scrapecreators.com/v1/account/credit-balance").mock(
        return_value=httpx.Response(200, json={"success": True, "creditCount": 50})
    )
    respx.get("https://api.scrapecreators.com/v1/account/get-daily-usage-count").mock(
        return_value=httpx.Response(
            200, json=[{"usage_date": "2020-01-01T00:00:00.000Z", "total_credits": "9", "request_count": "9"}]
        )
    )

    result = get_account_usage("fake-key")

    assert result == {"credits_remaining": 50, "credits_used_today": None, "requests_today": None}


@respx.mock
def test_get_account_usage_keeps_balance_when_daily_usage_call_fails():
    """The balance is the primary number; a broken secondary call shouldn't
    take it down with it."""
    respx.get("https://api.scrapecreators.com/v1/account/credit-balance").mock(
        return_value=httpx.Response(200, json={"success": True, "creditCount": 50})
    )
    respx.get("https://api.scrapecreators.com/v1/account/get-daily-usage-count").mock(
        return_value=httpx.Response(500)
    )

    result = get_account_usage("fake-key")

    assert result == {"credits_remaining": 50, "credits_used_today": None, "requests_today": None}
