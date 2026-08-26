from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter
from app.scraper.parser import parse_vehicle_specs

BASE_URL = "https://api.scrapecreators.com/v1/facebook/marketplace"
MILES_TO_KM = 1.60934


def _headers(api_key: str) -> dict[str, str]:
    return {"x-api-key": api_key}


def _resolve_coordinates(db: Session, search_filter: SearchFilter, api_key: str) -> tuple[float, float]:
    """Geocode search_filter.location once via ScrapeCreators' own location-search
    endpoint and cache it on the filter — the marketplace search endpoint needs
    lat/lng, not a place name, and re-resolving every run would spend a credit
    for no reason since a filter's location rarely changes."""
    if search_filter.latitude is not None and search_filter.longitude is not None:
        return float(search_filter.latitude), float(search_filter.longitude)

    if not search_filter.location:
        raise ValueError(
            f"Search filter {search_filter.id!r} has no location set — ScrapeCreators needs one to geocode"
        )

    response = httpx.get(
        f"{BASE_URL}/location/search",
        headers=_headers(api_key),
        params={"query": search_filter.location},
        timeout=15.0,
    )
    response.raise_for_status()
    locations = response.json().get("locations") or []
    if not locations:
        raise ValueError(f"ScrapeCreators found no location match for {search_filter.location!r}")

    best = locations[0]
    latitude, longitude = float(best["latitude"]), float(best["longitude"])

    search_filter.latitude = latitude
    search_filter.longitude = longitude
    db.commit()

    return latitude, longitude


def _search(
    api_key: str, query: str | None, latitude: float, longitude: float, results_limit: int, search_filter: SearchFilter
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"query": query or "", "lat": latitude, "lng": longitude, "count": results_limit}
    if search_filter.radius_miles is not None:
        params["radius_km"] = round(search_filter.radius_miles * MILES_TO_KM)
    if search_filter.min_price is not None:
        params["min_price"] = search_filter.min_price
    if search_filter.max_price is not None:
        params["max_price"] = search_filter.max_price
    if search_filter.condition:
        params["condition"] = search_filter.condition

    # Single page only — daily volumes at this project's scale (tens of results
    # per filter) fit in one page; a `has_next_page`/`cursor` follow-up loop can
    # be added if that stops being true.
    response = httpx.get(f"{BASE_URL}/search", headers=_headers(api_key), params=params, timeout=30.0)
    response.raise_for_status()
    return response.json().get("listings") or []


def _fetch_item_detail(api_key: str, listing_id: str) -> dict[str, Any] | None:
    response = httpx.get(f"{BASE_URL}/item", headers=_headers(api_key), params={"id": listing_id}, timeout=30.0)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()


def _extract_condition(attributes: list[dict[str, Any]] | None) -> str | None:
    """`attributes` is a loosely-documented list of {name/type, value}-shaped
    entries covering condition/type/material — this is a best-effort scan, not
    a confirmed schema; verify against a live response before relying on it."""
    for attribute in attributes or []:
        label = str(attribute.get("name") or attribute.get("type") or "").lower()
        if "condition" in label:
            return attribute.get("value")
    return None


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _normalize(item: dict[str, Any], detail: dict[str, Any] | None) -> dict[str, Any]:
    title = (detail or item).get("title") or ""
    price = (detail or item).get("price") or {}
    location = detail.get("location") if detail else None
    location_text_source = detail.get("location_text") if detail else (item.get("location") or {}).get("display_name")

    photos = (detail or {}).get("photos") or []
    photo_urls = [p["url"] for p in photos if p.get("url")]
    if not photo_urls and item.get("primary_photo", {}).get("url"):
        photo_urls = [item["primary_photo"]["url"]]

    specs = parse_vehicle_specs(title, None)

    return {
        "fb_listing_id": item["id"],
        "url": item["url"],
        "title": title,
        "description": (detail or {}).get("description"),
        "price_amount": price.get("amount"),
        "currency": price.get("currency", "USD"),
        "strikethrough_price_amount": ((detail or item).get("strikethrough_price") or {}).get("amount"),
        "condition": _extract_condition((detail or {}).get("attributes")),
        "is_live": item.get("is_live", True),
        "is_pending": item.get("is_pending", False),
        "is_sold": item.get("is_sold", False),
        "location_text": location_text_source,
        "latitude": (location or {}).get("latitude"),
        "longitude": (location or {}).get("longitude"),
        "postal_code": None,  # not provided by either ScrapeCreators endpoint
        "posted_at": _parse_timestamp((detail or {}).get("creation_time")),
        "raw_scraper_data": detail or item,
        "photo_urls": photo_urls,
        **specs,
    }


def fetch_listings(
    db: Session, search_filter: SearchFilter, results_limit: int, config: AppSettings
) -> list[dict[str, Any]]:
    api_key = config.scrape_creators_api_key
    if not api_key:
        raise RuntimeError("ScrapeCreators API key is not configured")

    latitude, longitude = _resolve_coordinates(db, search_filter, api_key)
    items = _search(api_key, search_filter.query, latitude, longitude, results_limit, search_filter)

    normalized = []
    for item in items:
        # Full detail (description/condition/photos/precise lat-lng) costs one
        # extra credit per listing — see the plan's cost notes — but scoring
        # depends on description/condition, so it's fetched unconditionally,
        # matching Apify's own `includeListingDetails=True` default.
        detail = _fetch_item_detail(api_key, item["id"])
        normalized.append(_normalize(item, detail))

    return normalized
