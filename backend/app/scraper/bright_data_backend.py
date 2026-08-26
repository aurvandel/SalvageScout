"""Bright Data Facebook Marketplace item-detail scraper (Web Scraper API, not
the paid Datasets marketplace — 5K free records/month, $1.5/1K after).

Confirmed by direct calls against the live API — not docs, which turned out to
describe input modes this dataset doesn't actually accept:
- Single endpoint: POST /datasets/v3/scrape?dataset_id=gd_lvt9iwuh6fbcwmx1a,
  body {"input": [{"url": ...}, ...], "limit_per_input": null}.
- Item-detail ONLY. A keyword input is rejected outright (400: "This input
  should not contain a keyword field"). A Marketplace search URL is rejected
  too ("Not a product page", bad_input) — only a real listing item URL works.
  So this scraper can't discover listings at all; it's a detail-enrichment
  step layered on top of a real discovery backend (Apify/ScrapeCreators), not
  a ScraperBackend in its own right.
- The response is NEWLINE-DELIMITED JSON, one object per input line — not a
  JSON array, despite what Bright Data's own docs examples show. Order isn't
  guaranteed to match input order. Errors (bad url, or a transient issue like
  "Redirect to login page" seen on a live call) come back as their own line
  with an `error`/`error_code` rather than failing the whole request.
"""

import json
from datetime import datetime
from typing import Any

import httpx

BASE_URL = "https://api.brightdata.com/datasets/v3/scrape"
DATASET_ID = "gd_lvt9iwuh6fbcwmx1a"


def _headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    final_price = raw.get("final_price")
    initial_price = raw.get("initial_price")

    return {
        "title": raw.get("title"),
        "description": raw.get("description") or raw.get("seller_description"),
        "price_amount": final_price if final_price is not None else initial_price,
        "currency": raw.get("currency"),
        "strikethrough_price_amount": initial_price if initial_price != final_price else None,
        "condition": raw.get("condition"),
        "is_sold": raw.get("is_sold"),
        "location_text": raw.get("location"),
        "mileage": raw.get("car_miles"),
        "posted_at": _parse_timestamp(raw.get("listing_date")),
        "photo_urls": raw.get("images") or [],
    }


def fetch_details(api_key: str, urls: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch detail for each url in one batched call. Returns {url: normalized
    fields} only for urls that succeeded — a url that errors (bad input, or a
    transient fetch failure) is simply absent, left for the caller to fall
    back to whatever the primary scraper backend already returned for it."""
    if not urls:
        return {}

    response = httpx.post(
        BASE_URL,
        headers=_headers(api_key),
        params={"dataset_id": DATASET_ID, "include_errors": "true"},
        json={"input": [{"url": url} for url in urls], "limit_per_input": None},
        timeout=90.0,
    )
    response.raise_for_status()

    results: dict[str, dict[str, Any]] = {}
    for line in response.text.splitlines():
        line = line.strip()
        if not line:
            continue
        raw = json.loads(line)
        if raw.get("error"):
            continue
        url = raw.get("url") or (raw.get("input") or {}).get("url")
        if url:
            results[url] = _normalize(raw)
    return results


def enrich_listings(items: list[dict[str, Any]], api_key: str) -> list[dict[str, Any]]:
    """Layer Bright Data's item detail onto already-normalized listings from
    the primary scraper backend, one batched call for the whole set. Only
    overwrites fields Bright Data actually returned a value for, so a listing
    it couldn't fetch (or returned a sparser record for) keeps the primary
    source's data instead of getting nulled out."""
    urls = [item["url"] for item in items if item.get("url")]
    details = fetch_details(api_key, urls)

    enriched = []
    for item in items:
        detail = details.get(item.get("url"))
        if detail is None:
            enriched.append(item)
            continue
        merged = dict(item)
        for key, value in detail.items():
            if value is not None:
                merged[key] = value
        enriched.append(merged)
    return enriched
