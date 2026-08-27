from datetime import datetime, timezone
from typing import Any

from app.scraper.parser import parse_mileage_from_text, parse_vehicle_specs, parse_year_make_model


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _price_amount(price: dict[str, Any] | None) -> float | None:
    if not price or price.get("amount") is None:
        return None
    return float(price["amount"])


def normalize_listing(raw: dict[str, Any]) -> dict[str, Any]:
    """Map a raw apify/facebook-marketplace-scraper dataset item to Listing column kwargs."""
    title = (raw.get("listingTitle") or "").strip()
    location = raw.get("location") or {}
    reverse_geocode = location.get("reverse_geocode_detailed") or {}
    price = raw.get("listingPrice") or {}

    specs = parse_vehicle_specs(title, raw.get("customSubTitlesWithRenderingFlags"))

    return {
        "fb_listing_id": raw["id"],
        "url": raw["itemUrl"],
        "title": title,
        "description": (raw.get("description") or {}).get("text"),
        "price_amount": _price_amount(price),
        "currency": price.get("currency"),
        "strikethrough_price_amount": _price_amount(raw.get("strikethroughPrice")),
        "condition": raw.get("condition"),
        "is_live": raw.get("isLive", True),
        "is_pending": raw.get("isPending", False),
        "is_sold": raw.get("isSold", False),
        "location_text": (raw.get("locationText") or {}).get("text"),
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "postal_code": reverse_geocode.get("postal_code_trimmed"),
        "posted_at": _parse_timestamp(raw.get("timestamp")),
        "raw_scraper_data": raw,
        "photo_urls": extract_photo_urls(raw),
        **specs,
    }


def extract_photo_urls(raw: dict[str, Any]) -> list[str]:
    photos = raw.get("listingPhotos") or []
    return [p["image"]["uri"] for p in photos if p.get("image", {}).get("uri")]


def _price_amount_curious_coder(price: dict[str, Any] | None) -> float | None:
    if not price or price.get("amount") is None:
        return None
    try:
        return float(price["amount"])
    except (TypeError, ValueError):
        return None


def _mileage_from_odometer(odometer: dict[str, Any] | None) -> int | None:
    if not odometer or odometer.get("value") is None:
        return None
    try:
        value = float(odometer["value"])
    except (TypeError, ValueError):
        return None
    if (odometer.get("unit") or "").strip().lower().startswith("km"):
        value *= 0.621371
    return int(value)


def extract_photo_urls_curious_coder(raw: dict[str, Any]) -> list[str]:
    photos = raw.get("listing_photos") or []
    urls = [p["image"]["uri"] for p in photos if p.get("image", {}).get("uri")]
    if urls:
        return urls
    primary = raw.get("primary_listing_photo_url")
    return [primary] if primary else []


def normalize_listing_curious_coder(raw: dict[str, Any]) -> dict[str, Any]:
    """Map a raw curious_coder/facebook-marketplace dataset item to Listing column kwargs.

    Field names come from the actor's published docs, not a confirmed live
    sample (no Apify credits were available to run it) — see
    CURIOUS_CODER_ACTOR_ID in apify_client.py. Every read below is
    .get()-based so a renamed/missing field degrades one listing's data
    instead of failing the whole run; only `id` (needed for the fb_listing_id
    unique constraint and to synthesize the item URL) is required.
    """
    title = (raw.get("marketplace_listing_title") or raw.get("custom_title") or "").strip()
    location = raw.get("location") or {}
    reverse_geocode = location.get("reverse_geocode") or {}
    price = raw.get("listing_price") or {}

    year, make, model = parse_year_make_model(title)
    make = raw.get("vehicle_make_display_name") or make
    model = raw.get("vehicle_model_display_name") or model
    description = (raw.get("redacted_description") or {}).get("text")
    mileage = _mileage_from_odometer(raw.get("vehicle_odometer_data"))
    if mileage is None:
        mileage = parse_mileage_from_text(title) or parse_mileage_from_text(description)

    creation_time = raw.get("creation_time")
    posted_at = datetime.fromtimestamp(creation_time, tz=timezone.utc) if isinstance(creation_time, (int, float)) else None

    location_text = ", ".join(part for part in (reverse_geocode.get("city"), reverse_geocode.get("state")) if part) or None

    fb_listing_id = raw["id"]
    return {
        "fb_listing_id": fb_listing_id,
        "url": f"https://www.facebook.com/marketplace/item/{fb_listing_id}/",
        "title": title,
        "description": description,
        "price_amount": _price_amount_curious_coder(price),
        "currency": price.get("currency"),
        "strikethrough_price_amount": None,
        "condition": raw.get("condition"),
        "is_live": raw.get("is_live", True),
        "is_pending": raw.get("is_pending", False),
        "is_sold": raw.get("is_sold", False),
        "location_text": location_text,
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "postal_code": None,
        "posted_at": posted_at,
        "raw_scraper_data": raw,
        "photo_urls": extract_photo_urls_curious_coder(raw),
        "year": year,
        "make": make,
        "model": model,
        "mileage": mileage,
    }
