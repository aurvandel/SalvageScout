from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.models import AppSettings


def get_app_settings(db: Session) -> AppSettings:
    """The DB-backed singleton config row, seeded from env vars on first read.
    After that first read, the DB is the sole source of truth — admin panel
    edits persist here and are visible to both the `backend` and `scheduler`
    processes, unlike a mutation of the env-loaded `settings` singleton."""
    config = db.query(AppSettings).filter_by(id=1).first()
    if config is None:
        config = AppSettings(
            id=1,
            llm_provider=env_settings.llm_provider,
            llm_model=env_settings.llm_model,
            anthropic_api_key=env_settings.anthropic_api_key,
            openai_api_key=env_settings.openai_api_key,
            gemini_api_key=env_settings.gemini_api_key,
            apify_token=env_settings.apify_token,
            discord_webhook_url=env_settings.discord_webhook_url,
            discord_enabled=bool(env_settings.discord_webhook_url),
            telegram_bot_token=env_settings.telegram_bot_token,
            telegram_chat_id=env_settings.telegram_chat_id,
            telegram_enabled=bool(env_settings.telegram_bot_token and env_settings.telegram_chat_id),
            notification_score_threshold=env_settings.notification_score_threshold,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_api_key_for_provider(config: AppSettings, provider: str) -> str | None:
    return {
        "anthropic": config.anthropic_api_key,
        "openai": config.openai_api_key,
        "gemini": config.gemini_api_key,
    }.get(provider)
