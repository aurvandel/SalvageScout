from app.models import Listing
from app.scorer.base import build_listing_text


def _listing(**overrides):
    defaults = dict(
        fb_listing_id="1",
        url="https://example.com",
        title="2014 Chevrolet Impala",
        price_amount=2500.0,
        currency="USD",
        year=2014,
        make="Chevrolet",
        model="Impala",
        mileage=2000,
        location_text="Rocky Mount, NC",
        condition="USED",
        description="Great car",
        raw_scraper_data={},
    )
    defaults.update(overrides)
    return Listing(**defaults)


def test_build_listing_text_includes_core_fields():
    text = build_listing_text(_listing())
    assert "2014 Chevrolet Impala" in text
    assert "2000" in text  # mileage
    assert "2500.0" in text
    assert "Rocky Mount, NC" in text
    assert "Great car" in text


def test_build_listing_text_handles_missing_fields():
    text = build_listing_text(_listing(year=None, make=None, model=None, mileage=None, description=None))
    assert "unknown" in text
    assert "(no description provided)" in text


def test_build_listing_text_includes_strikethrough_when_present():
    text = build_listing_text(_listing(strikethrough_price_amount=3000.0))
    assert "3000.0" in text
    assert "marked down" in text


def test_build_listing_text_omits_strikethrough_when_absent():
    text = build_listing_text(_listing())
    assert "marked down" not in text
