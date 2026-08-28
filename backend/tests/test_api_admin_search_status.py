import pytest

from app import search_status
from app.models import SearchFilter


@pytest.fixture(autouse=True)
def _reset_search_status():
    search_status._state = search_status.SearchStatus()
    yield
    search_status._state = search_status.SearchStatus()


def _make_active_filter(db):
    sf = SearchFilter(
        name="test",
        search_url="https://www.facebook.com/marketplace/x/search/?query=sedan",
        is_active=True,
    )
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def test_search_status_defaults_to_idle(client):
    response = client.get("/api/admin/search-status")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "idle"
    assert body["run_id"] == 0
    assert body["total_listings"] == 0
    assert body["new_listings"] == 0


def test_trigger_search_with_no_active_filters_leaves_status_idle(client):
    response = client.post("/api/admin/trigger-search")

    assert response.status_code == 202
    assert response.json()["message"] == "No active search filters found"
    assert client.get("/api/admin/search-status").json()["status"] == "idle"


def test_trigger_search_rejects_when_already_running(db, client, mocker):
    mocker.patch("app.api.admin._run_pipeline_background")
    _make_active_filter(db)
    search_status.try_start(filters_triggered=1)  # simulate a run already in flight

    response = client.post("/api/admin/trigger-search")

    assert response.status_code == 202
    assert response.json()["message"] == "A search is already running"


def test_trigger_search_status_reflects_completed_background_run(db, client, mocker):
    def fake_background(filter_ids):
        search_status.mark_completed(total_listings=7, new_listings=3)

    mocker.patch("app.api.admin._run_pipeline_background", side_effect=fake_background)
    _make_active_filter(db)

    trigger_response = client.post("/api/admin/trigger-search")
    assert trigger_response.status_code == 202
    assert "Search started" in trigger_response.json()["message"]

    status = client.get("/api/admin/search-status").json()
    assert status["status"] == "completed"
    assert status["total_listings"] == 7
    assert status["new_listings"] == 3
