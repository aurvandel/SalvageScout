"""Bright Data Facebook Marketplace "discover by keyword" backend.

UNVERIFIED CONTRACT: the trigger/poll/snapshot flow, request shape, and
response fields below come from secondary sources (search-engine summaries of
Bright Data's docs) — direct fetches to docs.brightdata.com were network-
blocked from the environment this was written in, so none of it is
primary-source-confirmed. Before relying on this in production: get a real
API key + dataset_id, run one call, and adjust `_normalize`/`_trigger`/
`_poll_until_ready` to match whatever comes back. See the plan file
(apify-is-going-to-bright-quiche.md) for the full caveat.
"""

import time
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter
from app.scraper.parser import parse_vehicle_specs

BASE_URL = "https://api.brightdata.com/datasets/v3"
POLL_INTERVAL_SECONDS = 3.0
POLL_TIMEOUT_SECONDS = 120.0


def _headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _trigger(api_key: str, dataset_id: str, search_filter: SearchFilter, results_limit: int) -> str:
    payload = [
        {
            "keyword": search_filter.query or "",
            "location": search_filter.location,
            "min_price": search_filter.min_price,
            "max_price": search_filter.max_price,
            "limit": results_limit,
        }
    ]
    response = httpx.post(
        f"{BASE_URL}/trigger",
        headers=_headers(api_key),
        params={"dataset_id": dataset_id, "include_errors": "true"},
        json=payload,
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()["snapshot_id"]


def _poll_until_ready(api_key: str, snapshot_id: str) -> None:
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        response = httpx.get(f"{BASE_URL}/progress/{snapshot_id}", headers=_headers(api_key), timeout=15.0)
        response.raise_for_status()
        status = response.json().get("status")
        if status == "ready":
            return
        if status == "failed":
            raise RuntimeError(f"Bright Data snapshot {snapshot_id} failed")
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError(f"Bright Data snapshot {snapshot_id} did not become ready within {POLL_TIMEOUT_SECONDS}s")


def _fetch_snapshot(api_key: str, snapshot_id: str) -> list[dict[str, Any]]:
    response = httpx.get(
        f"{BASE_URL}/snapshot/{snapshot_id}", headers=_headers(api_key), params={"format": "json"}, timeout=30.0
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
        "fb_listing_id": raw.get("product_id") or raw.get("id"),
        "url": raw["url"],
        "title": title,
        "description": raw.get("description") or raw.get("seller_description"),
        "price_amount": final_price if final_price is not None else initial_price,
        "currency": raw.get("currency", "USD"),
        "strikethrough_price_amount": initial_price if initial_price != final_price else None,
        "condition": raw.get("condition"),
        # Bright Data's example response has no live/pending/sold flags —
        # default to Apify's own "unknown means active" convention.
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
    if not config.bright_data_dataset_id:
        raise RuntimeError(
            "Bright Data dataset ID is not configured — find it on the Facebook Marketplace "
            "scraper's page in the Bright Data dashboard"
        )

    snapshot_id = _trigger(config.bright_data_api_key, config.bright_data_dataset_id, search_filter, results_limit)
    _poll_until_ready(config.bright_data_api_key, snapshot_id)
    raw_items = _fetch_snapshot(config.bright_data_api_key, snapshot_id)

    return [_normalize(raw) for raw in raw_items]
