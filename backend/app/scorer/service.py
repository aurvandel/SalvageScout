from sqlalchemy.orm import Session

from app.models import CriteriaProfile, Listing, Score
from app.scorer.registry import get_default_model, get_scorer
from app.settings_service import get_api_key_for_provider, get_app_settings


def score_and_store(
    db: Session, listing: Listing, criteria_profile: CriteriaProfile, provider: str | None = None, model: str | None = None
) -> Score:
    config = get_app_settings(db)
    provider = provider or config.llm_provider
    if not model:
        model = config.llm_model or get_default_model(provider)
    api_key = get_api_key_for_provider(config, provider)

    scorer_fn = get_scorer(provider)
    result, usage = scorer_fn(listing, criteria_profile, model, api_key)

    score = Score(
        listing_id=listing.id,
        criteria_profile_id=criteria_profile.id,
        match_score=result.match_score,
        summary=result.summary,
        pros=result.pros,
        cons=result.cons,
        dealbreaker_flags=result.dealbreaker_flags,
        model_used=f"{provider}/{model}",
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score
