import pytest

from app.models import CriteriaProfile, Score, SearchFilter
from app.pipeline import resolve_criteria_profile, run_pipeline_for_filter
from app.scorer.schemas import ScoreResult
from app.scraper.normalize import normalize_listing


def _make_search_filter(db):
    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def _make_active_profile(db):
    profile = CriteriaProfile(name="default", prompt_text="Score cars.", is_active=True)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def test_run_pipeline_raises_without_active_profile(db, raw_listings, mocker):
    mocker.patch("app.pipeline.run_scrape", return_value=[])
    sf = _make_search_filter(db)

    with pytest.raises(ValueError, match="No criteria profile configured"):
        run_pipeline_for_filter(db, sf)


def test_run_pipeline_scores_and_notifies_new_listings(db, raw_listings, monkeypatch, mocker):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    fake_result = ScoreResult(match_score=85, summary="Good.", pros=[], cons=[], dealbreaker_flags=[])
    mocker.patch("app.scorer.service.get_scorer", return_value=lambda l, c, m, k: fake_result)
    mock_notifier = mocker.Mock()
    mocker.patch("app.notifier.service.get_notifier", return_value=mock_notifier)

    sf = _make_search_filter(db)
    _make_active_profile(db)

    # ingest_listings (called by run_scrape) hits the real DB — patch the scraper backend only.
    mocker.patch(
        "app.scraper.service.get_scraper",
        return_value=lambda db, sf, limit, cfg: [normalize_listing(raw) for raw in raw_listings],
    )

    result = run_pipeline_for_filter(db, sf, results_limit=10)

    assert result.listings_processed == 3
    assert result.scores_created == 3
    assert result.notifications_sent == 3 * 2  # discord + telegram, all above threshold
    assert db.query(Score).count() == 3


def test_resolve_criteria_profile_prefers_linked_profile_over_global_active(db):
    global_active = _make_active_profile(db)
    linked = CriteriaProfile(name="iphones", prompt_text="Score iPhones.", is_active=False)
    db.add(linked)
    db.commit()
    db.refresh(linked)

    sf = _make_search_filter(db)
    sf.criteria_profile_id = linked.id
    db.commit()

    resolved = resolve_criteria_profile(db, sf)

    assert resolved.id == linked.id
    assert resolved.id != global_active.id


def test_resolve_criteria_profile_falls_back_to_global_active_when_unlinked(db):
    global_active = _make_active_profile(db)
    sf = _make_search_filter(db)

    resolved = resolve_criteria_profile(db, sf)

    assert resolved.id == global_active.id


def test_run_pipeline_skips_listings_already_scored_under_active_profile(db, raw_listings, monkeypatch, mocker):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    fake_result = ScoreResult(match_score=85, summary="Good.", pros=[], cons=[], dealbreaker_flags=[])
    mocker.patch("app.scorer.service.get_scorer", return_value=lambda l, c, m, k: fake_result)
    mocker.patch("app.notifier.service.get_notifier", return_value=mocker.Mock())
    mocker.patch(
        "app.scraper.service.get_scraper",
        return_value=lambda db, sf, limit, cfg: [normalize_listing(raw) for raw in raw_listings],
    )

    sf = _make_search_filter(db)
    _make_active_profile(db)

    first_result = run_pipeline_for_filter(db, sf, results_limit=10)
    second_result = run_pipeline_for_filter(db, sf, results_limit=10)

    assert first_result.scores_created == 3
    assert second_result.scores_created == 0  # already scored under this profile
    assert second_result.listings_processed == 3  # still scraped/upserted
    assert db.query(Score).count() == 3
