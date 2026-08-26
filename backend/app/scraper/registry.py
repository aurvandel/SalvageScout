from app.scraper import apify_backend, bright_data_backend, scrape_creators_backend
from app.scraper.base import ScraperBackend

_SCRAPERS: dict[str, ScraperBackend] = {
    "apify": apify_backend.fetch_listings,
    "bright_data": bright_data_backend.fetch_listings,
    "scrape_creators": scrape_creators_backend.fetch_listings,
}

# Providers that can consume a raw pasted FB search URL directly. Bright Data's
# scraper takes a Marketplace search URL as input (same one Apify uses, built by
# url_builder), so it supports url-mode too. ScrapeCreators needs structured
# fields (query, lat/lng, price range) and can't consume a URL at all.
_SUPPORTS_URL_MODE = {"apify", "bright_data"}


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
