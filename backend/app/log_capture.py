import logging

from app.db import SessionLocal
from app.models import LogEntry

_MAX_ROWS = 2000
_TRIM_EVERY = 100

_installed = False
_insert_count = 0


class DBLogHandler(logging.Handler):
    """Persists log records to the log_entries table so the admin panel's live
    log viewer can show them, and so scheduled pipeline runs — which happen in
    the separate `scheduler` process/container — are visible from the backend
    API too. Only keeps app.* records (at whatever level they're logged) or
    anything WARNING+ from elsewhere, to keep insert volume low and avoid
    capturing noisy third-party request logs at INFO."""

    def filter_record(self, record: logging.LogRecord) -> bool:
        return record.name == "app" or record.name.startswith("app.") or record.levelno >= logging.WARNING

    def emit(self, record: logging.LogRecord) -> None:
        global _insert_count

        if not self.filter_record(record):
            return

        try:
            message = self.format(record)
        except Exception:
            message = record.getMessage()

        try:
            db = SessionLocal()
            try:
                db.add(LogEntry(level=record.levelname, logger_name=record.name, message=message))
                db.commit()

                _insert_count += 1
                if _insert_count % _TRIM_EVERY == 0:
                    _trim(db)
            finally:
                db.close()
        except Exception:
            # A logging failure must never break the caller — including during
            # `alembic upgrade head`, before this table exists yet.
            pass


def _trim(db) -> None:
    from sqlalchemy import text

    db.execute(
        text("DELETE FROM log_entries WHERE id < (SELECT COALESCE(MAX(id), 0) - :keep FROM log_entries)"),
        {"keep": _MAX_ROWS},
    )
    db.commit()


def install_log_capture() -> None:
    """Call once per process (from both app.main and app.scheduler) so log
    lines from either process land in the same table."""
    global _installed
    if _installed:
        return
    _installed = True

    logging.getLogger("app").setLevel(logging.INFO)

    handler = DBLogHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logging.getLogger().addHandler(handler)
