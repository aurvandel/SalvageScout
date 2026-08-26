from app.models import CriteriaProfile, Listing, Score
from app.scorer.schemas import ScoreResult, TokenUsage
from app.scorer.service import score_and_store


def _seed(db):
    listing = Listing(
        fb_listing_id="1",
        url="https://example.com",
        title="2014 Chevrolet Impala",
        price_amount=2500.0,
        raw_scraper_data={},
    )
    profile = CriteriaProfile(name="default", prompt_text="Score this car.")
    db.add_all([listing, profile])
    db.commit()
    db.refresh(listing)
    db.refresh(profile)
    return listing, profile


def test_score_and_store_writes_score_row(db, mocker):
    listing, profile = _seed(db)
    fake_result = ScoreResult(match_score=72, summary="Decent deal.", pros=["Low price"], cons=["Old"], dealbreaker_flags=[])
    fake_usage = TokenUsage(input_tokens=120, output_tokens=40)
    mocker.patch("app.scorer.service.get_scorer", return_value=lambda l, c, m, k: (fake_result, fake_usage))

    score = score_and_store(db, listing, profile, provider="anthropic")

    assert score.id is not None
    assert score.listing_id == listing.id
    assert score.criteria_profile_id == profile.id
    assert score.match_score == 72
    assert score.summary == "Decent deal."
    assert score.pros == ["Low price"]
    assert score.cons == ["Old"]
    assert score.dealbreaker_flags == []
    assert score.model_used == "anthropic/claude-haiku-4-5"
    assert score.input_tokens == 120
    assert score.output_tokens == 40
    assert db.query(Score).count() == 1


def test_score_and_store_defaults_to_configured_provider(db, mocker):
    listing, profile = _seed(db)
    fake_result = ScoreResult(match_score=50, summary="Meh.", pros=[], cons=[], dealbreaker_flags=[])
    fake_usage = TokenUsage(input_tokens=100, output_tokens=30)
    get_scorer_mock = mocker.patch(
        "app.scorer.service.get_scorer", return_value=lambda l, c, m, k: (fake_result, fake_usage)
    )

    score_and_store(db, listing, profile)  # no provider passed

    get_scorer_mock.assert_called_once_with("anthropic")  # settings.llm_provider default
