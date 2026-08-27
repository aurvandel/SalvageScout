import logging
from decimal import Decimal
from typing import Any

from apify_client import ApifyClient
from apify_client.errors import ApifyApiError

logger = logging.getLogger(__name__)

ACTOR_ID = "apify/facebook-marketplace-scraper"

# HTTP statuses that indicate the *account* is the problem (bad/expired token,
# payment required, forbidden, rate-limited) rather than the request or actor —
# only these are worth retrying with a different account. Anything else (400
# bad input, 404 unknown actor, 5xx after the SDK's own retries) would just
# fail identically on every account, silently re-billing each one for the
# same broken run.
_FAILOVER_STATUS_CODES = {401, 402, 403, 429}

# Cheaper community alternative (~$0.50-$1.00/1K vs the official actor's
# $2.60-$5.00/1K — see curious_coder/facebook-marketplace on the Apify Store).
# Untested against a live run (no Apify credits available at integration time),
# so its input/output field names come from the actor's published docs, not a
# confirmed sample. Kept as a distinct branch below rather than assumed
# compatible with the official actor's schema.
CURIOUS_CODER_ACTOR_ID = "curious_coder/facebook-marketplace"

# Per-event pricing for CURIOUS_CODER_ACTOR_ID tops out around $0.001/item
# (full details) plus a small actor-start fee. 2x headroom over that plus a
# flat buffer, so a bad run aborts on Apify's side instead of draining an
# account that's already short on funds.
_CURIOUS_CODER_PRICE_PER_ITEM_USD = Decimal("0.002")
_CURIOUS_CODER_FLAT_BUFFER_USD = Decimal("0.05")


class ApifyFailoverError(RuntimeError):
    """Raised when fetch_listings_with_failover can't return a successful
    result — either every account was tried and failed, or an account
    raised a non-account-attributable error (fail-fast). Carries `attempts`
    (every account tried, including the one that triggered this) so the
    caller can still record per-account last_used_at/last_error even though
    no items were fetched — without this, that bookkeeping silently never
    runs on a fully-failed pipeline run, the case where it matters most."""

    def __init__(self, message: str, attempts: list[tuple[int, str | None]]):
        self.attempts = attempts
        super().__init__(message)


class ApifyRunFailedError(RuntimeError):
    """Raised when an Apify actor run finishes without SUCCEEDED status.
    `client.actor(...).call()` blocks until the run reaches a terminal state
    but does NOT raise for a non-success terminal state (FAILED, ABORTED,
    TIMED-OUT, ...) — without this check, that case silently returns zero
    listings instead of surfacing as an error."""

    def __init__(self, status: str, status_message: str | None):
        self.status = status
        self.status_message = status_message
        super().__init__(f"Apify run ended with status {status}: {status_message}")


def _build_run_input(actor_id: str, search_url: str, results_limit: int, include_details: bool) -> dict[str, Any]:
    if actor_id == CURIOUS_CODER_ACTOR_ID:
        return {
            "urls": [search_url],
            "getListingDetails": include_details,
            "getAllListingPhotos": True,
        }
    return {
        "startUrls": [{"url": search_url}],
        "resultsLimit": results_limit,
        "includeListingDetails": include_details,
    }


def fetch_listings(
    search_url: str,
    results_limit: int,
    include_details: bool = True,
    apify_token: str | None = None,
    actor_id: str = ACTOR_ID,
) -> list[dict[str, Any]]:
    if not apify_token:
        raise RuntimeError("Apify token is not configured")

    client = ApifyClient(apify_token)
    run_input = _build_run_input(actor_id, search_url, results_limit, include_details)
    call_kwargs: dict[str, Any] = {"run_input": run_input}
    if actor_id == CURIOUS_CODER_ACTOR_ID:
        # This actor has no documented results-limit input field, so cap
        # items and spend at the platform level instead of guessing one.
        call_kwargs["max_items"] = results_limit
        call_kwargs["max_total_charge_usd"] = (
            Decimal(results_limit) * _CURIOUS_CODER_PRICE_PER_ITEM_USD + _CURIOUS_CODER_FLAT_BUFFER_USD
        )
    run = client.actor(actor_id).call(**call_kwargs)
    if run.status != "SUCCEEDED":
        raise ApifyRunFailedError(run.status, run.status_message)
    return list(client.dataset(run.default_dataset_id).iterate_items())


def fetch_listings_with_failover(
    search_url: str,
    results_limit: int,
    accounts: list[tuple[int, str]],
    include_details: bool = True,
    actor_id: str = ACTOR_ID,
) -> tuple[list[dict[str, Any]], int, list[tuple[int, str | None]]]:
    """Try each (account_id, token) pair in the given order until one
    succeeds. `accounts` must already be ordered by the caller (priority,
    id) — this module stays free of DB/ORM concerns.

    Returns (items, succeeded_account_id, attempts), where attempts is
    [(account_id, error_or_None), ...] for every account tried, so the
    caller can record per-account last_used_at/last_error without this
    function touching the database.

    Fails over (tries the next account) only on an account-attributable
    error — an ApifyApiError with a status in _FAILOVER_STATUS_CODES, or a
    run that finished without SUCCEEDED. Any other ApifyApiError (bad
    request, unknown actor, server error) raises ApifyFailoverError
    immediately rather than being retried across every account.
    """
    if not accounts:
        raise RuntimeError("No Apify accounts are configured")

    attempts: list[tuple[int, str | None]] = []
    for account_id, token in accounts:
        try:
            items = fetch_listings(
                search_url, results_limit, include_details=include_details, apify_token=token, actor_id=actor_id
            )
            attempts.append((account_id, None))
            return items, account_id, attempts
        except ApifyApiError as e:
            if e.status_code not in _FAILOVER_STATUS_CODES:
                attempts.append((account_id, str(e)))
                raise ApifyFailoverError(str(e), attempts) from e
            logger.warning("Apify account id=%s failed (status %s), trying next account", account_id, e.status_code)
            attempts.append((account_id, str(e)))
        except ApifyRunFailedError as e:
            logger.warning("Apify account id=%s run failed (%s), trying next account", account_id, e)
            attempts.append((account_id, str(e)))

    raise ApifyFailoverError(f"All {len(accounts)} configured Apify account(s) failed: {attempts[-1][1]}", attempts)


def get_account_usage(apify_token: str | None) -> dict[str, Any]:
    """Current month's spend against the account's monthly usage limit."""
    if not apify_token:
        raise RuntimeError("Apify token is not configured")

    client = ApifyClient(apify_token)
    limits = client.user().limits()
    return {
        "used_usd": limits.current.monthly_usage_usd,
        "limit_usd": limits.limits.max_monthly_usage_usd,
        "cycle_start": limits.monthly_usage_cycle.start_at.isoformat(),
        "cycle_end": limits.monthly_usage_cycle.end_at.isoformat(),
    }
