"""Bright Data Facebook Marketplace scraper (Web Scraper API, not the paid
Datasets marketplace — 5K free records/month, $1.5/1K after).

Contract confirmed against Bright Data's own docs (docs.brightdata.com
api-reference/scrapers/social-media-apis/facebook-marketplace-discover-by-url
and .../facebook-marketplace-collect-by-url): a single synchronous POST to
/datasets/v3/scrape, no trigger/poll/snapshot dance. The "discover by keyword"
variant of this same dataset only accepts a bare keyword with no location/price
filtering, so this backend uses "discover by url" instead, feeding it the same
FB Marketplace search URL Apify already builds via url_builder — that URL's
query/minPrice/maxPrice/radius/itemCondition params are honored by the scraper
just like they are by a real browser hitting that page.
"""

from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter
from app.scraper.parser import parse_vehicle_specs
from app.scraper.url_builder import build_search_url

# Bright Data's pre-built "Facebook Marketplace" Web Scraper API dataset. Fixed
# and shared by every account using this scraper — not something a user creates
# or looks up in their dashboard, so unlike the old design this isn't admin-configurable.
DATASET_ID = "gd_lvt9iwuh6fbcwmx1a"
BASE_URL = "https://api.brightdata.com/datasets/v3/scrape"


def _headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _scrape(api_key: str, search_url: str, results_limit: int) -> list[dict[str, Any]]:
    response = httpx.post(
        BASE_URL,
        headers=_headers(api_key),
        params={"dataset_id": DATASET_ID, "notify": "false", "include_errors": "true"},
        json={"input": [{"url": search_url}], "limit_per_input": results_limit},
        timeout=60.0,
    )
    response.raise_for_status()
    return response.json() or []


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    title = raw.get("title") or ""
    final_price = raw.get("final_price")
    initial_price = raw.get("initial_price")
    specs = parse_vehicle_specs(title, None)

    return {
        "fb_listing_id": raw.get("product_id"),
        "url": raw["url"],
        "title": title,
        "description": raw.get("description") or raw.get("seller_description"),
        "price_amount": final_price if final_price is not None else initial_price,
        "currency": raw.get("currency", "USD"),
        "strikethrough_price_amount": initial_price if initial_price != final_price else None,
        "condition": raw.get("condition"),
        # No live/pending/sold flags in the response — default to "unknown means active".
        "is_live": True,
        "is_pending": False,
        "is_sold": False,
        "location_text": raw.get("location"),
        "latitude": None,
        "longitude": None,
        "postal_code": None,
        "posted_at": _parse_timestamp(raw.get("listing_date")),
        "raw_scraper_data": raw,
        "photo_urls": raw.get("images") or [],
        **specs,
    }


def fetch_listings(
    db: Session, search_filter: SearchFilter, results_limit: int, config: AppSettings
) -> list[dict[str, Any]]:
    if not config.bright_data_api_key:
        raise RuntimeError("Bright Data API key is not configured")

    search_url = build_search_url(search_filter)
    raw_items = _scrape(config.bright_data_api_key, search_url, results_limit)

    return [_normalize(raw) for raw in raw_items]
