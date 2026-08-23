from typing import Any

from apify_client import ApifyClient

from app.config import settings

ACTOR_ID = "apify/facebook-marketplace-scraper"


def fetch_listings(search_url: str, results_limit: int, include_details: bool = True) -> list[dict[str, Any]]:
    client = ApifyClient(settings.apify_token)
    run = client.actor(ACTOR_ID).call(
        run_input={
            "startUrls": [{"url": search_url}],
            "resultsLimit": results_limit,
            "includeListingDetails": include_details,
        }
    )
    return list(client.dataset(run.default_dataset_id).iterate_items())
