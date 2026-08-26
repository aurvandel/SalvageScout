from app.models import Listing, Score
from app.notifier.base import compose_message, truncate_for_limit


def _listing(**overrides):
    defaults = dict(
        fb_listing_id="1",
        url="https://www.facebook.com/marketplace/item/1/",
        title="2014 Chevrolet Impala",
        price_amount=2500.0,
        year=2014,
        make="Chevrolet",
        model="Impala",
        raw_scraper_data={},
    )
    defaults.update(overrides)
    return Listing(**defaults)


def _score(**overrides):
    defaults = dict(
        match_score=85,
        summary="Great budget car.",
        pros=["Cheap", "Low mileage"],
        cons=["Old"],
        dealbreaker_flags=[],
        model_used="claude-haiku-4-5",
    )
    defaults.update(overrides)
    return Score(**defaults)


def test_compose_message_includes_core_fields():
    text = compose_message(_listing(), _score())
    assert "2014 Chevrolet Impala" in text
    assert "$2,500" in text
    assert "85/100" in text
    assert "Great budget car." in text
    assert "- Cheap" in text
    assert "- Low mileage" in text
    assert "- Old" in text
    assert "https://www.facebook.com/marketplace/item/1/" in text


def test_compose_message_omits_empty_sections():
    text = compose_message(_listing(), _score(cons=[], dealbreaker_flags=[]))
    assert "Cons:" not in text
    assert "Dealbreakers" not in text


def test_compose_message_includes_dealbreakers_when_present():
    text = compose_message(_listing(), _score(dealbreaker_flags=["Salvage title"]))
    assert "Dealbreakers" in text
    assert "- Salvage title" in text


def test_compose_message_handles_missing_price_and_vehicle_fields():
    text = compose_message(_listing(price_amount=None, year=None, make=None, model=None), _score())
    assert "price unknown" in text
    assert "2014 Chevrolet Impala" in text  # falls back to title


def test_truncate_for_limit_no_op_under_limit():
    text = "short message"
    assert truncate_for_limit(text, "https://example.com/1", 2000) == text


def test_truncate_for_limit_preserves_url_when_over_limit():
    url = "https://www.facebook.com/marketplace/item/123456789/"
    text = ("x" * 3000) + f"\n\n{url}"

    result = truncate_for_limit(text, url, 2000)

    assert len(result) <= 2000
    assert result.endswith(url)
    assert "…" in result


def test_truncate_for_limit_exact_boundary_is_not_truncated():
    url = "https://example.com/1"
    text = "x" * 2000
    assert truncate_for_limit(text, url, 2000) == text
