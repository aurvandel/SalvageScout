import json

import httpx
import pytest
import respx

from app.scraper.bright_data_backend import enrich_listings, fetch_details, get_account_usage

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
    # is_sold is deliberately not mapped — the discovery provider owns it and
    # would silently clobber it back to False on the next run otherwise.
    assert "is_sold" not in detail
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
def test_fetch_details_chunks_large_batches():
    # A single oversized batch risks losing everything to one timeout; chunking
    # bounds that to CHUNK_SIZE records per request.
    urls = [f"https://www.facebook.com/marketplace/item/{i}/" for i in range(15)]
    route = respx.post("https://api.brightdata.com/datasets/v3/scrape").mock(
        side_effect=lambda request: httpx.Response(
            200,
            text=_ndjson(*[
                {**RAW_ITEM_A, "url": item["url"], "input": {"url": item["url"]}}
                for item in json.loads(request.content)["input"]
            ]),
        )
    )

    results = fetch_details("fake-key", urls)

    assert route.call_count == 2
    assert len(json.loads(route.calls[0].request.content)["input"]) == 10
    assert len(json.loads(route.calls[1].request.content)["input"]) == 5
    assert set(results.keys()) == set(urls)


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


def test_enrich_listings_never_overwrites_identity_fields(monkeypatch):
    # _normalize doesn't currently emit fb_listing_id/url, but the merge loop
    # guards against them explicitly rather than relying on that omission —
    # this proves the guard itself, independent of _normalize's current shape.
    monkeypatch.setattr(
        "app.scraper.bright_data_backend.fetch_details",
        lambda api_key, urls: {ITEM_A_URL: {"fb_listing_id": "wrong-id", "url": "https://evil.example/", "title": "new title"}},
    )

    items = [{"fb_listing_id": "correct-id", "url": ITEM_A_URL, "title": "old title"}]
    enriched = enrich_listings(items, "fake-key")

    assert enriched[0]["fb_listing_id"] == "correct-id"
    assert enriched[0]["url"] == ITEM_A_URL
    assert enriched[0]["title"] == "new title"


@respx.mock
def test_get_account_usage_returns_balance_and_pending():
    respx.get("https://api.brightdata.com/customer/balance").mock(
        return_value=httpx.Response(200, json={"balance": 42.5, "credit": 0, "prepayment": 0, "pending_costs": 1.25})
    )

    result = get_account_usage("fake-key")

    assert result == {"balance_usd": 42.5, "pending_balance_usd": 1.25}


@respx.mock
def test_get_account_usage_includes_response_body_in_error():
    """A scoped API key gets a 403 whose body names the fix (change token
    permissions) — confirmed live. raise_for_status() would discard that body
    behind a bare "403 Forbidden", so the error message must carry it."""
    respx.get("https://api.brightdata.com/customer/balance").mock(
        return_value=httpx.Response(403, text="Your API key lacks the required permissions for this action.")
    )

    with pytest.raises(RuntimeError, match="lacks the required permissions"):
        get_account_usage("fake-key")
