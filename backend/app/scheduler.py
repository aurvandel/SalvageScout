import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db import SessionLocal
from app.models import SearchFilter
from app.pipeline import run_pipeline_for_filter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DAILY_RESULTS_LIMIT = 20


def run_all_active_filters() -> None:
    db = SessionLocal()
    try:
        search_filters = db.query(SearchFilter).filter_by(is_active=True).all()
        for search_filter in search_filters:
            try:
                result = run_pipeline_for_filter(db, search_filter, results_limit=DAILY_RESULTS_LIMIT)
                logger.info(
                    "Pipeline run for %r: %s listings, %s scores, %s notifications",
                    search_filter.name,
                    result.listings_processed,
                    result.scores_created,
                    result.notifications_sent,
                )
            except Exception:
                logger.exception("Pipeline run failed for search_filter_id=%s", search_filter.id)
    finally:
        db.close()


def main() -> None:
    scheduler = BlockingScheduler()
    scheduler.add_job(run_all_active_filters, CronTrigger(hour=6, minute=0), id="daily_scrape")
    logger.info("Scheduler started — daily run at 06:00 UTC. Use the API's /api/pipeline/run endpoint for on-demand runs.")
    scheduler.start()


if __name__ == "__main__":
    main()
