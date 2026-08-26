from typing import Any

from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter
from app.scraper.apify_client import fetch_listings as fetch_from_apify
from app.scraper.normalize import normalize_listing
from app.scraper.url_builder import build_search_url


def fetch_listings(
    db: Session, search_filter: SearchFilter, results_limit: int, config: AppSettings
) -> list[dict[str, Any]]:
    search_url = build_search_url(search_filter)
    raw_items = fetch_from_apify(
        search_url, results_limit, apify_token=config.apify_token, actor_id=config.apify_actor_id
    )
    return [normalize_listing(raw) for raw in raw_items]
