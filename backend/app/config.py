from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root .env (docker-compose services run with this file's directory as their
# context; local tooling like Alembic runs from backend/, so resolve absolutely).
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    database_url: str
    apify_token: str | None = None
    anthropic_api_key: str
    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    discord_webhook_url: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    image_storage_dir: str = "data/images"
    llm_provider: str = "anthropic"
    llm_model: str = ""
    notification_score_threshold: int = 70


settings = Settings()
