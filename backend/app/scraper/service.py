from sqlalchemy.orm import Session

from app.models import Listing, SearchFilter
from app.scraper.apify_client import fetch_listings
from app.scraper.ingest import ingest_listings
from app.scraper.query_filter import matches_query
from app.scraper.url_builder import build_search_url
from app.settings_service import get_app_settings


def run_scrape(db: Session, search_filter: SearchFilter, results_limit: int = 20) -> list[Listing]:
    config = get_app_settings(db)
    search_url = build_search_url(search_filter)
    raw_items = fetch_listings(
        search_url, results_limit, apify_token=config.apify_token, actor_id=config.apify_actor_id
    )
    # Filter raw_items to match the search query
    filtered_items = [item for item in raw_items if matches_query(item, search_filter)]
    return ingest_listings(db, search_filter, filtered_items)
