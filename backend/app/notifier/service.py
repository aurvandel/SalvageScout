import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import NotificationLog, Score
from app.notifier.registry import enabled_channels, get_notifier
from app.settings_service import get_app_settings

logger = logging.getLogger(__name__)


def _already_notified(db: Session, listing_id: int, channel: str) -> bool:
    existing = db.execute(
        select(NotificationLog).where(NotificationLog.listing_id == listing_id, NotificationLog.channel == channel)
    ).scalar_one_or_none()
    return existing is not None


def notify_if_above_threshold(
    db: Session,
    score: Score,
    threshold: int | None = None,
    channels: tuple[str, ...] | None = None,
) -> list[NotificationLog]:
    """Send `score`'s listing to every not-yet-notified, enabled channel, once
    match_score clears the threshold. Dedup is per listing+channel — a listing
    that already triggered a Discord alert won't re-alert there even from a
    later re-score."""
    config = get_app_settings(db)
    threshold = threshold if threshold is not None else config.notification_score_threshold
    channels = channels if channels is not None else tuple(enabled_channels(config))

    if score.match_score < threshold:
        return []

    listing = score.listing
    logs = []

    for channel in channels:
        if _already_notified(db, listing.id, channel):
            continue

        try:
            get_notifier(channel)(listing, score, config)
            status = "sent"
        except Exception:
            status = "failed"
            logger.exception("Notification failed: listing_id=%s channel=%s", listing.id, channel)

        log = NotificationLog(listing_id=listing.id, score_id=score.id, channel=channel, status=status)
        db.add(log)
        logs.append(log)

    db.commit()
    return logs
