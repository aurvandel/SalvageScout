from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppSettings(Base):
    """Singleton row (id=1), same pattern as SchedulerConfig. This is the
    source of truth for everything the admin panel edits — `backend` and
    `scheduler` run as separate processes/containers, so an in-memory change
    to the env-loaded `Settings` object in one would never reach the other.
    First read seeds this row from env vars (see settings_service.py);
    after that, DB always wins."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)

    llm_provider: Mapped[str] = mapped_column(String, nullable=False, default="anthropic")
    llm_model: Mapped[str] = mapped_column(String, nullable=False, default="")
    anthropic_api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    openai_api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    gemini_api_key: Mapped[str | None] = mapped_column(String, nullable=True)

    apify_actor_id: Mapped[str] = mapped_column(
        String, nullable=False, default="apify/facebook-marketplace-scraper"
    )

    scraper_provider: Mapped[str] = mapped_column(String, nullable=False, default="apify")
    bright_data_api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    # Bright Data isn't a selectable scraper_provider (its scraper is item-detail
    # only — see registry.py) — this gates an optional post-discovery enrichment
    # step instead, off by default since it's extra billed usage on top of the
    # primary provider.
    bright_data_enrichment_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scrape_creators_api_key: Mapped[str | None] = mapped_column(String, nullable=True)

    discord_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    discord_webhook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    telegram_bot_token: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_chat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notification_score_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=70)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
