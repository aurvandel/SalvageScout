import logging
import time

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db import SessionLocal
from app.log_capture import install_log_capture
from app.models import SearchFilter, SchedulerConfig
from app.pipeline import run_pipeline_for_filter

logging.basicConfig(level=logging.INFO)
install_log_capture()
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


def get_scheduler_config():
    db = SessionLocal()
    try:
        config = db.query(SchedulerConfig).filter_by(id=1).first()
        if config is None:
            config = SchedulerConfig(id=1, is_enabled=True, run_hour=6, run_minute=0)
            db.add(config)
            db.commit()
        return config
    finally:
        db.close()


def main() -> None:
    scheduler = BlockingScheduler()
    config = get_scheduler_config()

    if config.is_enabled:
        scheduler.add_job(
            run_all_active_filters,
            CronTrigger(hour=config.run_hour, minute=config.run_minute),
            id="daily_scrape"
        )
        logger.info(
            "Scheduler started — daily run at %02d:%02d UTC. Use the API's /api/pipeline/run endpoint for on-demand runs.",
            config.run_hour,
            config.run_minute
        )
    else:
        logger.info("Scheduler is disabled. Use the API's /api/pipeline/run endpoint for manual runs.")

    scheduler.start()


if __name__ == "__main__":
    main()
