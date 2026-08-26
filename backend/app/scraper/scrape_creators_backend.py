from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter
from app.scraper.parser import parse_vehicle_specs

BASE_URL = "https://api.scrapecreators.com/v1/facebook/marketplace"
ACCOUNT_BASE_URL = "https://api.scrapecreators.com/v1/account"
MILES_TO_KM = 1.60934

# SearchFilter.condition is free text shared across providers (the admin UI's
# placeholder is "used", matching Apify's own convention) but ScrapeCreators'
# search endpoint only accepts this fixed enum — confirmed against its live
# tool schema. Sending anything else risks a 400 or a silently-ignored filter,
# so only forward values that match; anything else is dropped rather than sent.
_VALID_CONDITIONS = {"new", "used_like_new", "used_good", "used_fair"}


def _headers(api_key: str) -> dict[str, str]:
    return {"x-api-key": api_key}


def get_account_usage(api_key: str) -> dict[str, Any]:
    """Remaining prepaid credit balance, plus today's spend if that call
    succeeds. ScrapeCreators sells credit packs rather than a monthly limit
    like Apify, so there's no used/limit pair — just a balance. The
    daily-usage call is best-effort: it's a secondary number, so a failure
    there shouldn't cost the caller the (more important) balance figure."""
    balance_response = httpx.get(f"{ACCOUNT_BASE_URL}/credit-balance", headers=_headers(api_key), timeout=10.0)
    balance_response.raise_for_status()
    credits_remaining = balance_response.json()["creditCount"]

    credits_used_today = None
    requests_today = None
    try:
        daily_response = httpx.get(f"{ACCOUNT_BASE_URL}/get-daily-usage-count", headers=_headers(api_key), timeout=10.0)
        daily_response.raise_for_status()
        today_str = datetime.now(timezone.utc).date().isoformat()
        today_row = next((row for row in daily_response.json() if row["usage_date"].startswith(today_str)), None)
        if today_row is not None:
            credits_used_today = int(today_row["total_credits"])
            requests_today = int(today_row["request_count"])
    except httpx.HTTPError:
        pass

    return {
        "credits_remaining": credits_remaining,
        "credits_used_today": credits_used_today,
        "requests_today": requests_today,
    }


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

    # Results mix canonical cities (subtitle == "City") with neighborhood/landmark
    # check-in pages and same-named cities in other states — e.g. querying "Austin"
    # returns "Austin, IL" before "Austin, Texas". Prefer the first "City" match;
    # only fall back to the raw first result if none is marked as a city.
    best = next((loc for loc in locations if loc.get("subtitle") == "City"), locations[0])
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
    if search_filter.condition and search_filter.condition.lower() in _VALID_CONDITIONS:
        params["condition"] = search_filter.condition.lower()

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


def _extract_condition(detail: dict[str, Any] | None) -> str | None:
    """The item-detail endpoint returns `condition` as a flat string (e.g.
    "USED") directly on the response — confirmed against a live call. Fall back
    to scanning `attributes` only for the rare response where the flat field is
    absent but the attribute list carries it instead."""
    if not detail:
        return None
    if detail.get("condition"):
        return detail["condition"]
    for attribute in detail.get("attributes") or []:
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

    # strikethrough_price.amount comes back as a numeric string ("3000.00")
    # while price.amount is a plain int — confirmed on a live search response.
    # Coerce explicitly since the column is Numeric, not Float.
    strikethrough_amount = ((detail or item).get("strikethrough_price") or {}).get("amount")
    strikethrough_amount = float(strikethrough_amount) if strikethrough_amount is not None else None

    photos = (detail or {}).get("photos") or []
    photo_urls = [p["url"] for p in photos if p.get("url")]
    if not photo_urls and item.get("primary_photo", {}).get("url"):
        photo_urls = [item["primary_photo"]["url"]]

    specs = parse_vehicle_specs(title, None)
    # ScrapeCreators returns mileage as a pre-parsed {value, unit} on the detail
    # response — confirmed live — which is more reliable than scanning the title
    # for inline text, and is the *only* source when the title doesn't carry
    # mileage at all (e.g. "1995 Ford F-150 · XLT Pickup 2D 6 1/2 ft").
    detail_mileage = ((detail or {}).get("mileage") or {}).get("value")
    if detail_mileage is not None:
        specs["mileage"] = detail_mileage

    return {
        "fb_listing_id": item["id"],
        "url": item["url"],
        "title": title,
        "description": (detail or {}).get("description"),
        "price_amount": price.get("amount"),
        "currency": price.get("currency", "USD"),
        "strikethrough_price_amount": strikethrough_amount,
        "condition": _extract_condition(detail),
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
    # `count` in the search request is advisory, not enforced — a live call with
    # count=5 came back with 13 listings and has_next_page=true. Slice explicitly
    # so a filter's results_limit actually bounds the (much more expensive)
    # per-listing detail calls below, one credit each.
    items = items[:results_limit]

    normalized = []
    for item in items:
        # Full detail (description/condition/photos/precise lat-lng) costs one
        # extra credit per listing — see the plan's cost notes — but scoring
        # depends on description/condition, so it's fetched unconditionally,
        # matching Apify's own `includeListingDetails=True` default.
        detail = _fetch_item_detail(api_key, item["id"])
        normalized.append(_normalize(item, detail))

    return normalized
