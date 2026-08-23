import httpx

from app.config import settings
from app.models import Listing, Score
from app.notifier.base import compose_message


def send(listing: Listing, score: Score) -> None:
    if not settings.discord_webhook_url:
        raise RuntimeError("DISCORD_WEBHOOK_URL is not configured")

    response = httpx.post(
        settings.discord_webhook_url,
        json={"content": compose_message(listing, score)},
        timeout=15.0,
    )
    response.raise_for_status()
