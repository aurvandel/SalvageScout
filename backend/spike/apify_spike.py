"""
Dev utility for probing the apify/facebook-marketplace-scraper actor (the
official, first-party one — see the plan file for why this replaced the
originally-planned parseforge/facebook-marketplace-scraper).

Usage:
    python apify_spike.py --inspect     # print the actor's real input schema/example
    python apify_spike.py --run         # run it once with INPUT below, save raw output

Still open (see plan "Open Items" #1): confirm FB search-URL query params like
minPrice/maxPrice/radius actually filter server-side before relying on them in
search_filters.search_url — the initial spike only exercised a bare ?query=.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from apify_client import ApifyClient

ACTOR_ID = "apify/facebook-marketplace-scraper"
OUTPUT_PATH = Path(__file__).parent / "spike_output.json"

# Real input schema (confirmed via --inspect against the actor's build definition):
#   startUrls: [{url: <real Facebook Marketplace URL>}, ...] — city/category/search pages
#   resultsLimit: int, how many listings to return
#   includeListingDetails: bool, default false — when true, adds description, location
#     coordinates, timestamp, and listing attributes (no login required).
INPUT = {
    "startUrls": [
        {"url": "https://www.facebook.com/marketplace/newyork/search/?query=sedan"},
    ],
    "resultsLimit": 10,
    "includeListingDetails": True,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true", help="print actor metadata/input schema, no run")
    parser.add_argument("--run", action="store_true", help="run the actor once and save raw output")
    args = parser.parse_args()

    if not args.inspect and not args.run:
        parser.print_help()
        sys.exit(1)

    load_dotenv(dotenv_path=Path(__file__).parents[2] / ".env")
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("APIFY_TOKEN not set — add it to .env in the project root", file=sys.stderr)
        sys.exit(1)

    client = ApifyClient(token)

    if args.inspect:
        actor = client.actor(ACTOR_ID).get()
        print(actor.model_dump_json(indent=2))
        return

    if args.run:
        print(f"Running {ACTOR_ID} with input:\n{json.dumps(INPUT, indent=2)}\n")
        run = client.actor(ACTOR_ID).call(run_input=INPUT)

        items = list(client.dataset(run.default_dataset_id).iterate_items())
        OUTPUT_PATH.write_text(json.dumps(items, indent=2, default=str))

        print(f"Saved {len(items)} items to {OUTPUT_PATH}")
        print(f"usage_total_usd: {run.usage_total_usd}")
        print(f"charged_event_counts: {json.dumps(run.charged_event_counts, indent=2, default=str)}")
        print("\nCheck the Apify Console run/usage page to confirm actual dollar cost of this run.")


if __name__ == "__main__":
    main()
