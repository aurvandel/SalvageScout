from sqlalchemy.orm import Session

from app.models import SearchFilter
from app.scraper.bright_data_backend import enrich_listings
from app.scraper.ingest import IngestResult, ingest_listings
from app.scraper.query_filter import filter_listings_by_query
from app.scraper.registry import get_scraper, supports_search_mode
from app.settings_service import get_app_settings


def run_scrape(db: Session, search_filter: SearchFilter, results_limit: int = 20) -> IngestResult:
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
    # Optional detail enrichment (Bright Data can't discover listings itself —
    # see registry.py — only enrich what survived the query filter, not
    # everything the primary provider returned, to avoid paying for listings
    # about to be discarded).
    if config.bright_data_enrichment_enabled and config.bright_data_api_key:
        filtered_items = enrich_listings(filtered_items, config.bright_data_api_key)
    return ingest_listings(db, search_filter, filtered_items)
