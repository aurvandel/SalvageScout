from typing import Any

from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter
from app.scraper.apify_client import CURIOUS_CODER_ACTOR_ID
from app.scraper.apify_client import fetch_listings as fetch_from_apify
from app.scraper.normalize import normalize_listing, normalize_listing_curious_coder
from app.scraper.url_builder import build_search_url

# Keyed by apify_actor_id since each actor has its own dataset item shape.
# Actors not listed here (including the official default) use normalize_listing.
_NORMALIZERS = {
    CURIOUS_CODER_ACTOR_ID: normalize_listing_curious_coder,
}


def fetch_listings(
    db: Session, search_filter: SearchFilter, results_limit: int, config: AppSettings
) -> list[dict[str, Any]]:
    search_url = build_search_url(search_filter)
    raw_items = fetch_from_apify(
        search_url, results_limit, apify_token=config.apify_token, actor_id=config.apify_actor_id
    )
    normalize = _NORMALIZERS.get(config.apify_actor_id, normalize_listing)
    return [normalize(raw) for raw in raw_items]
