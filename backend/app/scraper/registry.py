from app.scraper import apify_backend, scrape_creators_backend
from app.scraper.base import ScraperBackend

# Bright Data isn't here — its scraper is item-detail-only (confirmed live: it
# rejects both keyword and search-url input), so it can't discover listings
# from a SearchFilter and isn't a ScraperBackend. It's wired in separately as
# an optional detail-enrichment step in scraper/service.py.
_SCRAPERS: dict[str, ScraperBackend] = {
    "apify": apify_backend.fetch_listings,
    "scrape_creators": scrape_creators_backend.fetch_listings,
}

# Providers that can consume a raw pasted FB search URL directly. ScrapeCreators
# needs structured fields (query, lat/lng, price range) and can't consume a URL.
_SUPPORTS_URL_MODE = {"apify"}


def get_scraper(provider: str) -> ScraperBackend:
    try:
        return _SCRAPERS[provider]
    except KeyError:
        raise ValueError(f"Unknown scraper provider {provider!r}. Available: {sorted(_SCRAPERS)}") from None


def get_available_scraper_providers() -> list[str]:
    return sorted(_SCRAPERS.keys())


def supports_search_mode(provider: str, search_mode: str) -> bool:
    if search_mode == "url":
        return provider in _SUPPORTS_URL_MODE
    return True
