from sqlalchemy.orm import Session

from app.models import Listing, SearchFilter
from app.scraper.ingest import ingest_listings
from app.scraper.query_filter import filter_listings_by_query
from app.scraper.registry import get_scraper, supports_search_mode
from app.settings_service import get_app_settings


def run_scrape(db: Session, search_filter: SearchFilter, results_limit: int = 20) -> list[Listing]:
    config = get_app_settings(db)
    provider = config.scraper_provider

    if not supports_search_mode(provider, search_filter.search_mode):
        raise ValueError(
            f"Search filter {search_filter.name!r} uses search_mode={search_filter.search_mode!r}, "
            f"which the active scraper provider {provider!r} can't consume — switch the filter to "
            "location mode or pick a different provider in the admin panel"
        )

    scraper = get_scraper(provider)
    items = scraper(db, search_filter, results_limit, config)
    # Filter items to match the search query using batch LLM call
    filtered_items = filter_listings_by_query(db, items, search_filter)
    return ingest_listings(db, search_filter, filtered_items)
