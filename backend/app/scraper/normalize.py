from datetime import datetime
from typing import Any

from app.scraper.parser import parse_vehicle_specs


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
        "raw_apify_data": raw,
        **specs,
    }


def extract_photo_urls(raw: dict[str, Any]) -> list[str]:
    photos = raw.get("listingPhotos") or []
    return [p["image"]["uri"] for p in photos if p.get("image", {}).get("uri")]
