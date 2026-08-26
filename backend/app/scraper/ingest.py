from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Listing, ListingImage, SearchFilter
from app.scraper.images import download_images


def ingest_listings(db: Session, search_filter: SearchFilter, items: list[dict[str, Any]]) -> list[Listing]:
    """Upsert already-normalized listings (see app/scraper/base.py) by
    fb_listing_id. New listings get their photos downloaded; re-seeing an
    existing listing just refreshes its mutable fields — its images were
    already downloaded on first sight and don't need re-fetching."""
    touched = []

    for item in items:
        fields = dict(item)
        photo_urls = fields.pop("photo_urls", [])
        fb_listing_id = fields["fb_listing_id"]

        existing = db.execute(select(Listing).where(Listing.fb_listing_id == fb_listing_id)).scalar_one_or_none()

        if existing is None:
            listing = Listing(search_filter_id=search_filter.id, **fields)
            db.add(listing)
            db.flush()  # assign listing.id so ListingImage rows can reference it

            for image in download_images(fb_listing_id, photo_urls):
                db.add(ListingImage(listing_id=listing.id, **image))
        else:
            for key, value in fields.items():
                # A provider that doesn't return a field (e.g. Bright Data has no
                # postal_code) shouldn't null out a value an earlier provider set.
                if key == "fb_listing_id" or value is None:
                    continue
                setattr(existing, key, value)
            existing.last_seen_at = datetime.now(timezone.utc)
            listing = existing

        touched.append(listing)

    db.commit()
    return touched
