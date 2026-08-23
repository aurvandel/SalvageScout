import httpx

from app.config import settings
from app.models import Listing, Score
from app.notifier.base import compose_message

API_BASE = "https://api.telegram.org"


def send(listing: Listing, score: Score) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not configured")

    response = httpx.post(
        f"{API_BASE}/bot{settings.telegram_bot_token}/sendMessage",
        json={"chat_id": settings.telegram_chat_id, "text": compose_message(listing, score)},
        timeout=15.0,
    )
    response.raise_for_status()
