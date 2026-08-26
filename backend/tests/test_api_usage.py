from app.models import CriteriaProfile, Listing, Score
from app.settings_service import get_app_settings


def _seed_score(db, model_used="anthropic/claude-haiku-4-5", input_tokens=1000, output_tokens=200, fb_listing_id="1"):
    listing = Listing(
        fb_listing_id=fb_listing_id,
        url=f"https://example.com/{fb_listing_id}",
        title="2014 Chevrolet Impala",
        price_amount=2500.0,
        raw_scraper_data={},
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


def test_get_usage_scrape_creators_not_configured(client, db):
    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    body = response.json()["scrape_creators"]
    assert body["configured"] is False
    assert body["credits_remaining"] is None


def test_get_usage_scrape_creators_configured_calls_client(client, mocker):
    client.patch("/api/admin/settings/scraper", json={"scrape_creators_api_key": "fake-key"})
    mocker.patch(
        "app.api.admin.get_scrape_creators_usage",
        return_value={"credits_remaining": 97, "credits_used_today": 3, "requests_today": 3},
    )

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    body = response.json()["scrape_creators"]
    assert body["configured"] is True
    assert body["credits_remaining"] == 97
    assert body["credits_used_today"] == 3
    assert body["requests_today"] == 3


def test_get_usage_scrape_creators_reports_error_without_failing_request(client, mocker):
    client.patch("/api/admin/settings/scraper", json={"scrape_creators_api_key": "fake-key"})
    mocker.patch("app.api.admin.get_scrape_creators_usage", side_effect=RuntimeError("boom"))

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    assert response.json()["scrape_creators"]["error"] == "boom"


def test_get_usage_bright_data_not_configured(client, db):
    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    body = response.json()["bright_data"]
    assert body["configured"] is False
    assert body["balance_usd"] is None


def test_get_usage_bright_data_configured_calls_client(client, mocker):
    client.patch("/api/admin/settings/scraper", json={"bright_data_api_key": "fake-key"})
    mocker.patch(
        "app.api.admin.get_bright_data_usage",
        return_value={"balance_usd": 42.5, "pending_balance_usd": 1.25},
    )

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    body = response.json()["bright_data"]
    assert body["configured"] is True
    assert body["balance_usd"] == 42.5
    assert body["pending_balance_usd"] == 1.25


def test_get_usage_bright_data_reports_error_without_failing_request(client, mocker):
    client.patch("/api/admin/settings/scraper", json={"bright_data_api_key": "fake-key"})
    mocker.patch("app.api.admin.get_bright_data_usage", side_effect=RuntimeError("boom"))

    response = client.get("/api/admin/usage")

    assert response.status_code == 200
    assert response.json()["bright_data"]["error"] == "boom"


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
    assert row["priced_count"] == 1
    assert row["estimated_cost_usd"] == 6.0  # $1/M in + $5/M out at 1M tokens each


def test_get_usage_unknown_model_has_no_cost_estimate(client, db):
    _seed_score(db, model_used="anthropic/some-future-model")

    response = client.get("/api/admin/usage")

    row = response.json()["llm_all_time"][0]
    assert row["estimated_cost_usd"] is None


def test_get_usage_counts_pre_tracking_scores_separately_from_priced_ones(client, db):
    """Score rows written before this feature have NULL tokens (migration adds
    nullable columns, no backfill). scored_count must include them so the total
    isn't silently wrong, while priced_count/estimated_cost_usd must reflect only
    the rows that actually have token data — otherwise the UI shows a dollar
    figure that quietly excludes rows its own count claims to cover."""
    _seed_score(db, model_used="anthropic/claude-haiku-4-5", input_tokens=1_000_000, output_tokens=1_000_000, fb_listing_id="1")
    _seed_score(db, model_used="anthropic/claude-haiku-4-5", input_tokens=None, output_tokens=None, fb_listing_id="2")

    response = client.get("/api/admin/usage")

    row = response.json()["llm_all_time"][0]
    assert row["scored_count"] == 2
    assert row["priced_count"] == 1
    assert row["estimated_cost_usd"] == 6.0


def test_get_usage_this_month_excludes_nothing_for_freshly_seeded_scores(client, db):
    _seed_score(db)

    response = client.get("/api/admin/usage")

    body = response.json()
    assert len(body["llm_this_month"]) == 1
    assert len(body["llm_all_time"]) == 1
