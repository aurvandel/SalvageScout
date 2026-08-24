from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db
from app.models import SchedulerConfig, SearchFilter, ArenaRun, Listing, CriteriaProfile
from app.schemas.scheduler_config import SchedulerConfigIn, SchedulerConfigOut
from app.schemas.llm_config import LLMConfigIn, LLMConfigOut, ArenaRunIn, ArenaRunOut, ArenaScoreResult
from app.pipeline import run_pipeline_for_filter
from app.config import settings
from app.scorer.registry import get_available_providers, get_available_models, get_scorer
from app.scorer.schemas import ScoreResult
from app.scorer.base import build_listing_text

router = APIRouter(prefix="/admin", tags=["admin"])


class TriggerSearchResponse(BaseModel):
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


@router.post("/trigger-search", response_model=TriggerSearchResponse)
def trigger_search(db: Session = Depends(get_db)):
    import logging
    logger = logging.getLogger(__name__)

    active_filters = db.query(SearchFilter).filter_by(is_active=True).all()

    if not active_filters:
        return TriggerSearchResponse(
            message="No active search filters found",
            filters_triggered=0,
            total_listings_processed=0,
            total_scores_created=0,
            total_notifications_sent=0,
        )

    total_listings = 0
    total_scores = 0
    total_notifications = 0
    errors = []
    successful_filters = 0

    for search_filter in active_filters:
        try:
            result = run_pipeline_for_filter(db, search_filter, results_limit=20)
            total_listings += result.listings_processed
            total_scores += result.scores_created
            total_notifications += result.notifications_sent
            successful_filters += 1
        except Exception as e:
            error_msg = f"Filter '{search_filter.name}': {str(e)}"
            logger.exception("Pipeline run failed for filter_id=%s: %s", search_filter.id, error_msg)
            errors.append(error_msg)

    message = f"Triggered {successful_filters}/{len(active_filters)} filters"
    if errors:
        message += f" ({len(errors)} failed)"

    return TriggerSearchResponse(
        message=message,
        filters_triggered=successful_filters,
        total_listings_processed=total_listings,
        total_scores_created=total_scores,
        total_notifications_sent=total_notifications,
    )


@router.get("/llm-config", response_model=LLMConfigOut)
def get_llm_config():
    providers = get_available_providers()
    provider_models = {provider: get_available_models(provider) for provider in providers}

    return LLMConfigOut(
        current_provider=settings.llm_provider,
        current_model=settings.llm_model or get_available_models(settings.llm_provider)[0],
        available_providers=providers,
        provider_models=provider_models,
    )


@router.post("/llm-config")
def update_llm_config(payload: LLMConfigIn):
    available_providers = get_available_providers()
    if payload.provider not in available_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider {payload.provider!r}. Available: {available_providers}",
        )

    available_models = get_available_models(payload.provider)
    if payload.model not in available_models:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model {payload.model!r} for provider {payload.provider}. Available: {available_models}",
        )

    settings.llm_provider = payload.provider
    settings.llm_model = payload.model
    return {"message": "LLM configuration updated"}


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

    results = []
    for provider, model in zip(payload.providers, payload.models):
        try:
            scorer_fn = get_scorer(provider)
            score_result = scorer_fn(listing, criteria_profile, model)
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
