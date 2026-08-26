from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db
from app.models import SchedulerConfig, SearchFilter, ArenaRun, Listing, CriteriaProfile, Score
from app.schemas.scheduler_config import SchedulerConfigIn, SchedulerConfigOut
from app.schemas.llm_config import ArenaRunIn, ArenaRunOut, ArenaScoreResult
from app.schemas.app_settings import (
    AppSettingsOut,
    ApifySettingsIn,
    ApifySettingsOut,
    LLMSettingsIn,
    LLMSettingsOut,
    NotificationSettingsIn,
    NotificationSettingsOut,
    ScraperSettingsIn,
    ScraperSettingsOut,
    mask_secret,
)
from app.schemas.usage import ApifyUsageOut, LLMProviderUsageOut, UsageOut
from app.pipeline import run_pipeline_for_filter
from app.scorer.pricing import estimate_cost_usd
from app.scorer.registry import get_available_providers, get_available_models, get_scorer
from app.scraper.apify_client import get_account_usage
from app.scraper.registry import get_available_scraper_providers, supports_search_mode
from app.settings_service import get_api_key_for_provider, get_app_settings

router = APIRouter(prefix="/admin", tags=["admin"])


class TriggerSearchResponse(BaseModel):
    message: str


class TriggerSearchResultResponse(BaseModel):
    message: str
    filters_triggered: int
    total_listings_processed: int
    total_scores_created: int
    total_notifications_sent: int


@router.get("/scheduler-config", response_model=SchedulerConfigOut)
def get_scheduler_config(db: Session = Depends(get_db)):
    config = db.query(SchedulerConfig).filter_by(id=1).first()
    if config is None:
        config = SchedulerConfig(id=1, is_enabled=True, run_hour=6, run_minute=0)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.patch("/scheduler-config", response_model=SchedulerConfigOut)
def update_scheduler_config(payload: SchedulerConfigIn, db: Session = Depends(get_db)):
    config = db.query(SchedulerConfig).filter_by(id=1).first()
    if config is None:
        config = SchedulerConfig(id=1)
        db.add(config)

    config.is_enabled = payload.is_enabled
    config.run_hour = payload.run_hour
    config.run_minute = payload.run_minute
    db.commit()
    db.refresh(config)
    return config


def _run_pipeline_background(filter_ids: list[int]):
    import logging
    from app.db import SessionLocal
    from app.models import SearchFilter

    logger = logging.getLogger(__name__)
    db = SessionLocal()

    try:
        search_filters = db.query(SearchFilter).filter(SearchFilter.id.in_(filter_ids)).all()
        for search_filter in search_filters:
            try:
                run_pipeline_for_filter(db, search_filter, results_limit=search_filter.results_limit)
            except Exception as e:
                error_msg = f"Filter '{search_filter.name}': {str(e)}"
                logger.exception("Pipeline run failed for filter_id=%s: %s", search_filter.id, error_msg)
    finally:
        db.close()


@router.post("/trigger-search", response_model=TriggerSearchResponse, status_code=202)
def trigger_search(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    active_filters = db.query(SearchFilter).filter_by(is_active=True).all()

    if not active_filters:
        return TriggerSearchResponse(message="No active search filters found")

    filter_ids = [f.id for f in active_filters]
    background_tasks.add_task(_run_pipeline_background, filter_ids)
    return TriggerSearchResponse(message=f"Search started for {len(active_filters)} filter(s)")


def _incompatible_filter_names(db: Session, provider: str) -> list[str]:
    active_filters = db.query(SearchFilter).filter_by(is_active=True).all()
    return [f.name for f in active_filters if not supports_search_mode(provider, f.search_mode)]


def _settings_out(db: Session, config) -> AppSettingsOut:
    providers = get_available_providers()
    return AppSettingsOut(
        llm=LLMSettingsOut(
            provider=config.llm_provider,
            model=config.llm_model or get_available_models(config.llm_provider)[0],
            anthropic_api_key_masked=mask_secret(config.anthropic_api_key),
            openai_api_key_masked=mask_secret(config.openai_api_key),
            gemini_api_key_masked=mask_secret(config.gemini_api_key),
            available_providers=providers,
            provider_models={provider: get_available_models(provider) for provider in providers},
        ),
        apify=ApifySettingsOut(
            apify_token_masked=mask_secret(config.apify_token),
            actor_id=config.apify_actor_id,
        ),
        scraper=ScraperSettingsOut(
            provider=config.scraper_provider,
            available_providers=get_available_scraper_providers(),
            bright_data_api_key_masked=mask_secret(config.bright_data_api_key),
            bright_data_dataset_id=config.bright_data_dataset_id,
            scrape_creators_api_key_masked=mask_secret(config.scrape_creators_api_key),
            incompatible_filter_names=_incompatible_filter_names(db, config.scraper_provider),
        ),
        notifications=NotificationSettingsOut(
            discord_enabled=config.discord_enabled,
            discord_webhook_url_masked=mask_secret(config.discord_webhook_url),
            telegram_enabled=config.telegram_enabled,
            telegram_bot_token_masked=mask_secret(config.telegram_bot_token),
            telegram_chat_id=config.telegram_chat_id,
            notification_score_threshold=config.notification_score_threshold,
        ),
    )


@router.get("/settings", response_model=AppSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    config = get_app_settings(db)
    return _settings_out(db, config)


@router.patch("/settings/llm", response_model=AppSettingsOut)
def update_llm_settings(payload: LLMSettingsIn, db: Session = Depends(get_db)):
    config = get_app_settings(db)
    fields = payload.model_dump(exclude_unset=True)

    provider = fields.get("provider", config.llm_provider)
    available_providers = get_available_providers()
    if provider not in available_providers:
        raise HTTPException(
            status_code=400, detail=f"Unknown provider {provider!r}. Available: {available_providers}"
        )

    if "model" in fields:
        available_models = get_available_models(provider)
        if fields["model"] not in available_models:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model {fields['model']!r} for provider {provider}. Available: {available_models}",
            )
        config.llm_model = fields["model"]

    config.llm_provider = provider
    if "anthropic_api_key" in fields:
        config.anthropic_api_key = fields["anthropic_api_key"] or None
    if "openai_api_key" in fields:
        config.openai_api_key = fields["openai_api_key"] or None
    if "gemini_api_key" in fields:
        config.gemini_api_key = fields["gemini_api_key"] or None

    db.commit()
    db.refresh(config)
    return _settings_out(db, config)


@router.patch("/settings/apify", response_model=AppSettingsOut)
def update_apify_settings(payload: ApifySettingsIn, db: Session = Depends(get_db)):
    config = get_app_settings(db)
    fields = payload.model_dump(exclude_unset=True)

    if "apify_token" in fields:
        config.apify_token = fields["apify_token"] or None
    if "actor_id" in fields and fields["actor_id"]:
        config.apify_actor_id = fields["actor_id"]

    db.commit()
    db.refresh(config)
    return _settings_out(db, config)


@router.patch("/settings/scraper", response_model=AppSettingsOut)
def update_scraper_settings(payload: ScraperSettingsIn, db: Session = Depends(get_db)):
    config = get_app_settings(db)
    fields = payload.model_dump(exclude_unset=True)

    provider = fields.get("provider", config.scraper_provider)
    available_providers = get_available_scraper_providers()
    if provider not in available_providers:
        raise HTTPException(
            status_code=400, detail=f"Unknown scraper provider {provider!r}. Available: {available_providers}"
        )

    config.scraper_provider = provider
    if "bright_data_api_key" in fields:
        config.bright_data_api_key = fields["bright_data_api_key"] or None
    if "bright_data_dataset_id" in fields:
        config.bright_data_dataset_id = fields["bright_data_dataset_id"] or None
    if "scrape_creators_api_key" in fields:
        config.scrape_creators_api_key = fields["scrape_creators_api_key"] or None

    db.commit()
    db.refresh(config)
    return _settings_out(db, config)


@router.patch("/settings/notifications", response_model=AppSettingsOut)
def update_notification_settings(payload: NotificationSettingsIn, db: Session = Depends(get_db)):
    config = get_app_settings(db)
    fields = payload.model_dump(exclude_unset=True)

    if "discord_enabled" in fields:
        config.discord_enabled = fields["discord_enabled"]
    if "discord_webhook_url" in fields:
        config.discord_webhook_url = fields["discord_webhook_url"] or None
    if "telegram_enabled" in fields:
        config.telegram_enabled = fields["telegram_enabled"]
    if "telegram_bot_token" in fields:
        config.telegram_bot_token = fields["telegram_bot_token"] or None
    if "telegram_chat_id" in fields:
        config.telegram_chat_id = fields["telegram_chat_id"] or None
    if "notification_score_threshold" in fields:
        config.notification_score_threshold = fields["notification_score_threshold"]

    db.commit()
    db.refresh(config)
    return _settings_out(db, config)


@router.post("/arena-run", response_model=ArenaRunOut)
def run_arena(payload: ArenaRunIn, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter_by(id=payload.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing {payload.listing_id} not found")

    criteria_profile = db.query(CriteriaProfile).filter_by(id=payload.criteria_profile_id).first()
    if not criteria_profile:
        raise HTTPException(status_code=404, detail=f"Criteria profile {payload.criteria_profile_id} not found")

    available_providers = get_available_providers()
    for provider in payload.providers:
        if provider not in available_providers:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown provider {provider!r}. Available: {available_providers}",
            )

    for provider, model in zip(payload.providers, payload.models):
        available_models = get_available_models(provider)
        if model not in available_models:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model {model!r} for provider {provider}. Available: {available_models}",
            )

    config = get_app_settings(db)

    results = []
    for provider, model in zip(payload.providers, payload.models):
        try:
            scorer_fn = get_scorer(provider)
            api_key = get_api_key_for_provider(config, provider)
            score_result, _usage = scorer_fn(listing, criteria_profile, model, api_key)
            results.append(
                ArenaScoreResult(
                    provider=provider,
                    model=model,
                    match_score=score_result.match_score,
                    summary=score_result.summary,
                    pros=score_result.pros,
                    cons=score_result.cons,
                    dealbreaker_flags=score_result.dealbreaker_flags,
                )
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error scoring with {provider}/{model}: {str(e)}",
            )

    arena_run = ArenaRun(
        listing_id=payload.listing_id,
        criteria_profile_id=payload.criteria_profile_id,
        providers=payload.providers,
        models=payload.models,
        results={f"{r.provider}/{r.model}": r.model_dump() for r in results},
    )
    db.add(arena_run)
    db.commit()
    db.refresh(arena_run)

    return ArenaRunOut(
        id=arena_run.id,
        listing_id=arena_run.listing_id,
        criteria_profile_id=arena_run.criteria_profile_id,
        providers=arena_run.providers,
        models=arena_run.models,
        results=results,
        created_at=arena_run.created_at.isoformat(),
    )


def _aggregate_llm_usage(query) -> list[LLMProviderUsageOut]:
    """Older Score rows predate token tracking and have NULL input/output_tokens.
    priced_count (COUNT skips NULLs) tracks how many of scored_count actually fed
    the cost estimate, so the UI can say "priced N of M" instead of implying the
    dollar figure covers every scored listing."""
    rows = (
        query.with_entities(
            Score.model_used,
            func.count(Score.id),
            func.count(Score.input_tokens),
            func.coalesce(func.sum(Score.input_tokens), 0),
            func.coalesce(func.sum(Score.output_tokens), 0),
        )
        .group_by(Score.model_used)
        .all()
    )
    results = []
    for model_used, scored_count, priced_count, input_tokens, output_tokens in rows:
        provider, _, model = model_used.partition("/")
        results.append(
            LLMProviderUsageOut(
                provider=provider,
                model=model,
                scored_count=scored_count,
                priced_count=priced_count,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimate_cost_usd(model_used, input_tokens, output_tokens) if priced_count else None,
            )
        )
    return sorted(results, key=lambda r: (r.provider, r.model))


@router.get("/usage", response_model=UsageOut)
def get_usage(db: Session = Depends(get_db)):
    config = get_app_settings(db)

    apify_usage = ApifyUsageOut(configured=bool(config.apify_token))
    if config.apify_token:
        try:
            data = get_account_usage(config.apify_token)
            apify_usage.used_usd = data["used_usd"]
            apify_usage.limit_usd = data["limit_usd"]
            apify_usage.cycle_start = data["cycle_start"]
            apify_usage.cycle_end = data["cycle_end"]
        except Exception as e:
            apify_usage.error = str(e)

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    return UsageOut(
        apify=apify_usage,
        llm_this_month=_aggregate_llm_usage(db.query(Score).filter(Score.created_at >= month_start)),
        llm_all_time=_aggregate_llm_usage(db.query(Score)),
    )
