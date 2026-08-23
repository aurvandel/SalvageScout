from app.models import CriteriaProfile, SearchFilter
from app.pipeline import PipelineResult


def _make_search_filter(db):
    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def test_run_pipeline_not_found(client):
    response = client.post("/api/pipeline/run/999999")
    assert response.status_code == 404


def test_run_pipeline_without_active_profile_returns_400(db, client):
    sf = _make_search_filter(db)
    response = client.post(f"/api/pipeline/run/{sf.id}")
    assert response.status_code == 400
    assert "active criteria profile" in response.json()["detail"]


def test_run_pipeline_success(db, client, mocker):
    sf = _make_search_filter(db)
    db.add(CriteriaProfile(name="default", prompt_text="Score cars.", is_active=True))
    db.commit()

    mocker.patch(
        "app.api.pipeline.run_pipeline_for_filter",
        return_value=PipelineResult(listings_processed=3, scores_created=2, notifications_sent=1),
    )

    response = client.post(f"/api/pipeline/run/{sf.id}", params={"results_limit": 5})

    assert response.status_code == 200
    assert response.json() == {"listings_processed": 3, "scores_created": 2, "notifications_sent": 1}
