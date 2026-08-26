import json

import httpx
import respx

from app.scraper.bright_data_backend import enrich_listings, fetch_details

ITEM_A_URL = "https://www.facebook.com/marketplace/item/1470792311455307/"
ITEM_B_URL = "https://www.facebook.com/marketplace/item/3970017683303389/"

# Shape confirmed by direct calls against the live API (not docs — see the
# module docstring for why those were wrong). Response is NDJSON, one object
# per line, in no guaranteed order.
RAW_ITEM_A = {
    "url": ITEM_A_URL,
    "title": "1995 Ford F-150 · XLT Pickup 2D 6 1/2 ft",
    "initial_price": 6000,
    "final_price": 6000,
    "currency": "USD",
    "product_id": "1470792311455307",
    "condition": "USED",
    "description": "Runs and drives but needs alternator and power steering.",
    "location": "Austin, TX",
    "images": ["https://img.example.com/1.jpg"],
    "seller_description": "Runs and drives but needs alternator and power steering.",
    "is_sold": False,
    "car_miles": 250000,
    "listing_date": "2026-07-25T01:11:12.000Z",
    "input": {"url": ITEM_A_URL},
}

ERROR_LINE = {
    "timestamp": "2026-08-26T20:00:05.748Z",
    "input": {"url": ITEM_B_URL},
    "error": "Redirect to login page.",
    "error_code": "bad_input",
}


def _ndjson(*objects) -> str:
    return "\n".join(json.dumps(o) for o in objects)


@respx.mock
def test_fetch_details_normalizes_successful_items():
    route = respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        return_value=httpx.Response(200, text=_ndjson(RAW_ITEM_A))
    )

    results = fetch_details("fake-key", [ITEM_A_URL])

    assert list(results.keys()) == [ITEM_A_URL]
    detail = results[ITEM_A_URL]
    assert detail["title"] == "1995 Ford F-150 · XLT Pickup 2D 6 1/2 ft"
    assert detail["price_amount"] == 6000
    assert detail["mileage"] == 250000
    assert detail["is_sold"] is False
    assert detail["photo_urls"] == ["https://img.example.com/1.jpg"]

    request = route.calls.last.request
    assert request.url.params["dataset_id"] == "gd_lvt9iwuh6fbcwmx1a"
    body = json.loads(request.content)
    assert body["input"] == [{"url": ITEM_A_URL}]
    assert body["limit_per_input"] is None


@respx.mock
def test_fetch_details_omits_urls_that_error():
    # Confirmed live: errors (bad input, or a transient issue like "Redirect to
    # login page") come back as their own NDJSON line, not a raised exception.
    respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        return_value=httpx.Response(200, text=_ndjson(RAW_ITEM_A, ERROR_LINE))
    )

    results = fetch_details("fake-key", [ITEM_A_URL, ITEM_B_URL])

    assert list(results.keys()) == [ITEM_A_URL]


def test_fetch_details_returns_empty_without_making_a_request():
    results = fetch_details("fake-key", [])
    assert results == {}


@respx.mock
def test_enrich_listings_merges_detail_onto_primary_source_data():
    respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        return_value=httpx.Response(200, text=_ndjson(RAW_ITEM_A))
    )

    items = [
        {
            "fb_listing_id": "1470792311455307",
            "url": ITEM_A_URL,
            "title": "old title",
            "description": None,
            "mileage": None,
        }
    ]

    enriched = enrich_listings(items, "fake-key")

    assert len(enriched) == 1
    # fb_listing_id/url are preserved from the primary source, not overwritten.
    assert enriched[0]["fb_listing_id"] == "1470792311455307"
    assert enriched[0]["url"] == ITEM_A_URL
    assert enriched[0]["title"] == "1995 Ford F-150 · XLT Pickup 2D 6 1/2 ft"
    assert enriched[0]["mileage"] == 250000


@respx.mock
def test_enrich_listings_keeps_primary_data_when_bright_data_has_no_detail():
    respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        return_value=httpx.Response(200, text=_ndjson(ERROR_LINE))
    )

    items = [{"fb_listing_id": "x", "url": ITEM_B_URL, "title": "primary title"}]

    enriched = enrich_listings(items, "fake-key")

    assert enriched == items


def test_enrich_listings_skips_the_api_call_for_an_empty_list():
    assert enrich_listings([], "fake-key") == []
