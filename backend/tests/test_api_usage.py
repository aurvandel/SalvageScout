from app.models import CriteriaProfile, Listing, Score
from app.settings_service import get_app_settings


def _seed_score(db, model_used="anthropic/claude-haiku-4-5", input_tokens=1000, output_tokens=200):
    listing = Listing(
        fb_listing_id="1", url="https://example.com", title="2014 Chevrolet Impala", price_amount=2500.0, raw_apify_data={}
    )
    profile = CriteriaProfile(name="default", prompt_text="Score this car.")
    db.add_all([listing, profile])
    db.commit()
    db.refresh(listing)
    db.refresh(profile)

    score = Score(
        listing_id=listing.id,
        criteria_profile_id=profile.id,
        match_score=80,
        summary="Good.",
        pros=[],
        cons=[],
        dealbreaker_flags=[],
        model_used=model_used,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    db.add(score)
    db.commit()
    return score


def test_get_usage_apify_not_configured(client, db):
    config = get_app_settings(db)
    config.apify_token = None
    db.commit()

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    body = response.json()
    assert body["apify"]["configured"] is False
    assert body["apify"]["used_usd"] is None


def test_get_usage_apify_configured_calls_client(client, db, mocker):
    client.patch("/api/admin/settings/apify", json={"apify_token": "fake-apify-token"})
    mocker.patch(
        "app.api.admin.get_account_usage",
        return_value={
            "used_usd": 12.5,
            "limit_usd": 300.0,
            "cycle_start": "2026-08-01T00:00:00Z",
            "cycle_end": "2026-08-31T23:59:59Z",
        },
    )

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    apify = response.json()["apify"]
    assert apify["configured"] is True
    assert apify["used_usd"] == 12.5
    assert apify["limit_usd"] == 300.0


def test_get_usage_apify_reports_error_without_failing_request(client, mocker):
    client.patch("/api/admin/settings/apify", json={"apify_token": "fake-apify-token"})
    mocker.patch("app.api.admin.get_account_usage", side_effect=RuntimeError("boom"))

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    assert response.json()["apify"]["error"] == "boom"


def test_get_usage_aggregates_llm_spend_by_model(client, db):
    _seed_score(db, model_used="anthropic/claude-haiku-4-5", input_tokens=1_000_000, output_tokens=1_000_000)

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    rows = response.json()["llm_all_time"]
    assert len(rows) == 1
    row = rows[0]
    assert row["provider"] == "anthropic"
    assert row["model"] == "claude-haiku-4-5"
    assert row["scored_count"] == 1
    assert row["estimated_cost_usd"] == 6.0  # $1/M in + $5/M out at 1M tokens each


def test_get_usage_unknown_model_has_no_cost_estimate(client, db):
    _seed_score(db, model_used="anthropic/some-future-model")

    response = client.get("/api/admin/usage")

    row = response.json()["llm_all_time"][0]
    assert row["estimated_cost_usd"] is None


def test_get_usage_this_month_excludes_nothing_for_freshly_seeded_scores(client, db):
    _seed_score(db)

    response = client.get("/api/admin/usage")

    body = response.json()
    assert len(body["llm_this_month"]) == 1
    assert len(body["llm_all_time"]) == 1
