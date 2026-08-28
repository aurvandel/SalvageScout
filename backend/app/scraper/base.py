from typing import Any, Protocol

from sqlalchemy.orm import Session

from app.models import AppSettings, SearchFilter


class ScraperBackend(Protocol):
    """One function per scraper provider — same signature, same output shape
    (already-normalized listing dicts, the same keys normalize_listing()
    produces), so the provider is a config choice rather than a rewrite of
    everything downstream. Mirrors app/scorer/base.py's Scorer protocol.

    `db` is passed through (unlike the Scorer protocol) because a backend may
    need to persist per-filter state — e.g. ScrapeCreators caching a resolved
    lat/lng onto the SearchFilter so it isn't re-geocoded (and re-billed) on
    every run."""

    def __call__(
        self, db: Session, search_filter: SearchFilter, results_limit: int, config: AppSettings
    ) -> list[dict[str, Any]]: ...
