import copy
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

StatusValue = Literal["idle", "running", "completed", "error"]


@dataclass
class SearchStatus:
    status: StatusValue = "idle"
    run_id: int = 0
    started_at: str | None = None
    finished_at: str | None = None
    filters_triggered: int = 0
    total_listings: int = 0
    new_listings: int = 0
    error_message: str | None = None


_lock = threading.Lock()
_state = SearchStatus()


def try_start(filters_triggered: int) -> bool:
    """Atomically transition to running. Returns False if a run is already
    in progress — callers must check this before scheduling work, since a
    background task's own start can't be the guard (it runs after the
    response is already sent)."""
    global _state
    with _lock:
        if _state.status == "running":
            return False
        _state = SearchStatus(
            status="running",
            run_id=_state.run_id + 1,
            started_at=datetime.now(timezone.utc).isoformat(),
            filters_triggered=filters_triggered,
        )
        return True


def mark_completed(total_listings: int, new_listings: int, error_message: str | None = None) -> None:
    with _lock:
        _state.status = "completed"
        _state.finished_at = datetime.now(timezone.utc).isoformat()
        _state.total_listings = total_listings
        _state.new_listings = new_listings
        _state.error_message = error_message


def mark_error(message: str) -> None:
    with _lock:
        _state.status = "error"
        _state.finished_at = datetime.now(timezone.utc).isoformat()
        _state.error_message = message


def get_status() -> SearchStatus:
    with _lock:
        return copy.copy(_state)
