from typing import Any

from apify_client import ApifyClient

ACTOR_ID = "apify/facebook-marketplace-scraper"


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
    run = client.actor(actor_id).call(
        run_input={
            "startUrls": [{"url": search_url}],
            "resultsLimit": results_limit,
            "includeListingDetails": include_details,
        }
    )
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
