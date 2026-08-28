import pytest

from app import search_status


@pytest.fixture(autouse=True)
def _reset_search_status():
    """search_status holds module-level global state, so tests must reset it
    to avoid leaking a "running"/"completed" status into unrelated tests."""
    search_status._state = search_status.SearchStatus()
    yield
    search_status._state = search_status.SearchStatus()


def test_initial_status_is_idle():
    status = search_status.get_status()
    assert status.status == "idle"
    assert status.run_id == 0


def test_try_start_transitions_to_running():
    started = search_status.try_start(filters_triggered=2)

    assert started is True
    status = search_status.get_status()
    assert status.status == "running"
    assert status.filters_triggered == 2
    assert status.run_id == 1
    assert status.started_at is not None


def test_try_start_returns_false_while_already_running():
    search_status.try_start(filters_triggered=1)

    started_again = search_status.try_start(filters_triggered=1)

    assert started_again is False
    assert search_status.get_status().status == "running"


def test_mark_completed_sets_terminal_state_and_counts():
    search_status.try_start(filters_triggered=1)

    search_status.mark_completed(total_listings=10, new_listings=4)

    status = search_status.get_status()
    assert status.status == "completed"
    assert status.total_listings == 10
    assert status.new_listings == 4
    assert status.error_message is None
    assert status.finished_at is not None


def test_mark_completed_can_carry_a_partial_error_message():
    search_status.try_start(filters_triggered=2)

    search_status.mark_completed(total_listings=5, new_listings=1, error_message="Filter 'x': boom")

    status = search_status.get_status()
    assert status.status == "completed"
    assert status.error_message == "Filter 'x': boom"


def test_mark_error_sets_error_status():
    search_status.try_start(filters_triggered=1)

    search_status.mark_error("unexpected failure")

    status = search_status.get_status()
    assert status.status == "error"
    assert status.error_message == "unexpected failure"
    assert status.finished_at is not None


def test_try_start_after_completion_increments_run_id():
    search_status.try_start(filters_triggered=1)
    search_status.mark_completed(total_listings=1, new_listings=1)

    started = search_status.try_start(filters_triggered=1)

    assert started is True
    assert search_status.get_status().run_id == 2
