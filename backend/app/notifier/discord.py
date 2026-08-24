import httpx

from app.models import AppSettings, Listing, Score
from app.notifier.base import compose_message, truncate_for_limit

MAX_CONTENT_LENGTH = 2000  # Discord webhook `content` field hard limit


def send(listing: Listing, score: Score, config: AppSettings) -> None:
    if not config.discord_webhook_url:
        raise RuntimeError("DISCORD_WEBHOOK_URL is not configured")

    message = truncate_for_limit(compose_message(listing, score), listing.url, MAX_CONTENT_LENGTH)

    response = httpx.post(
        config.discord_webhook_url,
        json={"content": message},
        timeout=15.0,
    )
    response.raise_for_status()
