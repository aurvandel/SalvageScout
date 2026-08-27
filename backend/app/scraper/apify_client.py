from decimal import Decimal
from typing import Any

from apify_client import ApifyClient

ACTOR_ID = "apify/facebook-marketplace-scraper"

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
    return list(client.dataset(run.default_dataset_id).iterate_items())


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
