import httpx

from app.config import settings
from app.models import Listing, Score
from app.notifier.base import compose_message, truncate_for_limit

API_BASE = "https://api.telegram.org"
MAX_TEXT_LENGTH = 4096  # Telegram sendMessage `text` field hard limit


def send(listing: Listing, score: Score) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not configured")

    message = truncate_for_limit(compose_message(listing, score), listing.url, MAX_TEXT_LENGTH)

    response = httpx.post(
        f"{API_BASE}/bot{settings.telegram_bot_token}/sendMessage",
        json={"chat_id": settings.telegram_chat_id, "text": message},
        timeout=15.0,
    )
    response.raise_for_status()
