from sqlalchemy.orm import Session

from app.config import settings
from app.models import CriteriaProfile, Listing, Score
from app.scorer.registry import get_model_name, get_scorer


def score_and_store(
    db: Session, listing: Listing, criteria_profile: CriteriaProfile, provider: str | None = None
) -> Score:
    provider = provider or settings.llm_provider
    scorer_fn = get_scorer(provider)
    result = scorer_fn(listing, criteria_profile)

    score = Score(
        listing_id=listing.id,
        criteria_profile_id=criteria_profile.id,
        match_score=result.match_score,
        summary=result.summary,
        pros=result.pros,
        cons=result.cons,
        dealbreaker_flags=result.dealbreaker_flags,
        model_used=get_model_name(provider),
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score
