from sqlalchemy.orm import Session

from app.models import Listing, SearchFilter
from app.scraper.apify_client import fetch_listings
from app.scraper.ingest import ingest_listings


def run_scrape(db: Session, search_filter: SearchFilter, results_limit: int = 20) -> list[Listing]:
    raw_items = fetch_listings(search_filter.search_url, results_limit)
    return ingest_listings(db, search_filter, raw_items)
