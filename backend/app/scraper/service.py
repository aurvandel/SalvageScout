from sqlalchemy.orm import Session

from app.models import SearchFilter
from app.scraper.apify_client import fetch_listings
from app.scraper.ingest import IngestResult, ingest_listings
from app.scraper.query_filter import filter_listings_by_query
from app.scraper.url_builder import build_search_url
from app.settings_service import get_app_settings


def run_scrape(db: Session, search_filter: SearchFilter, results_limit: int = 20) -> IngestResult:
    config = get_app_settings(db)
    search_url = build_search_url(search_filter)
    raw_items = fetch_listings(
        search_url, results_limit, apify_token=config.apify_token, actor_id=config.apify_actor_id
    )
    # Filter raw_items to match the search query using batch LLM call
    filtered_items = filter_listings_by_query(db, raw_items, search_filter)
    return ingest_listings(db, search_filter, filtered_items)
