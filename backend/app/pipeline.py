from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import CriteriaProfile, Score, SearchFilter
from app.notifier.service import notify_if_above_threshold
from app.scorer.service import score_and_store
from app.scraper.service import run_scrape


@dataclass
class PipelineResult:
    listings_processed: int
    scores_created: int
    notifications_sent: int


def get_active_criteria_profile(db: Session) -> CriteriaProfile | None:
    return db.query(CriteriaProfile).filter_by(is_active=True).first()


def run_pipeline_for_filter(db: Session, search_filter: SearchFilter, results_limit: int = 20) -> PipelineResult:
    """Scrape a filter, then score+notify only listings not yet scored under the
    currently active criteria profile — re-seeing an already-scored listing on a
    later scrape shouldn't re-spend an LLM call. This is the single orchestration
    path for both the API's manual trigger and the future scheduler."""
    criteria_profile = get_active_criteria_profile(db)
    if criteria_profile is None:
        raise ValueError("No active criteria profile configured")

    listings = run_scrape(db, search_filter, results_limit=results_limit)

    scores_created = 0
    notifications_sent = 0

    for listing in listings:
        already_scored = (
            db.query(Score).filter_by(listing_id=listing.id, criteria_profile_id=criteria_profile.id).first()
        )
        if already_scored is not None:
            continue

        score = score_and_store(db, listing, criteria_profile)
        scores_created += 1

        logs = notify_if_above_threshold(db, score)
        notifications_sent += sum(1 for log in logs if log.status == "sent")

    return PipelineResult(
        listings_processed=len(listings),
        scores_created=scores_created,
        notifications_sent=notifications_sent,
    )
