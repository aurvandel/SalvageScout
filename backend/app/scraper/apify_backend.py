from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import AppSettings, ApifyAccount, SearchFilter
from app.scraper.apify_client import ApifyFailoverError, CURIOUS_CODER_ACTOR_ID
from app.scraper.apify_client import fetch_listings_with_failover
from app.scraper.normalize import normalize_listing, normalize_listing_curious_coder
from app.scraper.url_builder import build_search_url
from app.settings_service import get_apify_accounts

# Keyed by apify_actor_id since each actor has its own dataset item shape.
# Actors not listed here (including the official default) use normalize_listing.
_NORMALIZERS = {
    CURIOUS_CODER_ACTOR_ID: normalize_listing_curious_coder,
}


def _record_attempts(
    accounts_by_id: dict[int, ApifyAccount], attempts: list[tuple[int, str | None]], db: Session
) -> None:
    now = datetime.now(timezone.utc)
    for account_id, error in attempts:
        account = accounts_by_id[account_id]
        if error is None:
            account.last_used_at = now
            account.last_error = None
            account.last_error_at = None
        else:
            account.last_error = error
            account.last_error_at = now
    db.commit()


def fetch_listings(
    db: Session, search_filter: SearchFilter, results_limit: int, config: AppSettings
) -> list[dict[str, Any]]:
    search_url = build_search_url(search_filter)

    accounts = [a for a in get_apify_accounts(db) if a.is_active]
    if not accounts:
        raise RuntimeError("No active Apify accounts configured")

    accounts_by_id = {a.id: a for a in accounts}
    try:
        raw_items, _succeeded_account_id, attempts = fetch_listings_with_failover(
            search_url, results_limit, [(a.id, a.api_token) for a in accounts], actor_id=config.apify_actor_id
        )
    except ApifyFailoverError as e:
        # Record last_used_at/last_error even when every account failed (or
        # a non-account-attributable error fail-fasted) — otherwise this
        # bookkeeping only ever runs on a run that eventually succeeded.
        _record_attempts(accounts_by_id, e.attempts, db)
        raise

    _record_attempts(accounts_by_id, attempts, db)

    normalize = _NORMALIZERS.get(config.apify_actor_id, normalize_listing)
    return [normalize(raw) for raw in raw_items]
