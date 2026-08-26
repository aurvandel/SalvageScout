from app.models import Listing, ListingImage, SearchFilter
from app.scraper.ingest import ingest_listings
from app.scraper.normalize import normalize_listing


def _make_search_filter(db):
    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf


def _normalized(raw_items):
    return [normalize_listing(raw) for raw in raw_items]


def test_ingest_creates_new_listings_and_downloads_images(db, raw_listings, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [
        {"local_path": f"/fake/{fb_id}/{i}.jpg", "position": i} for i in range(len(urls))
    ])
    sf = _make_search_filter(db)

    touched = ingest_listings(db, sf, _normalized(raw_listings))

    assert len(touched) == 3
    assert db.query(Listing).count() == 3

    crown_vic = db.query(Listing).filter_by(fb_listing_id="839387795495137").one()
    assert crown_vic.year == 2003
    assert crown_vic.make == "Ford"
    assert crown_vic.search_filter_id == sf.id

    images = db.query(ListingImage).filter_by(listing_id=crown_vic.id).all()
    assert len(images) == 11  # matches the Crown Victoria's real photo count


def test_ingest_is_idempotent_on_fb_listing_id(db, raw_listings, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    sf = _make_search_filter(db)

    ingest_listings(db, sf, _normalized(raw_listings))
    ingest_listings(db, sf, _normalized(raw_listings))

    assert db.query(Listing).count() == 3


def test_ingest_updates_existing_listing_without_redownloading_images(db, raw_listings, monkeypatch):
    download_calls = []
    monkeypatch.setattr(
        "app.scraper.ingest.download_images",
        lambda fb_id, urls: download_calls.append(fb_id) or [{"local_path": "/fake/0.jpg", "position": 0}],
    )
    sf = _make_search_filter(db)

    ingest_listings(db, sf, _normalized(raw_listings))
    assert len(download_calls) == 3  # one call per new listing

    # Change price on one raw item to simulate a re-scrape picking up a price drop.
    updated = [dict(item) for item in raw_listings]
    crown_vic = next(item for item in updated if item["id"] == "839387795495137")
    crown_vic["listingPrice"] = {**crown_vic["listingPrice"], "amount": "1500.00"}

    ingest_listings(db, sf, _normalized(updated))

    assert len(download_calls) == 3  # no new download calls on re-ingest
    refreshed = db.query(Listing).filter_by(fb_listing_id="839387795495137").one()
    assert refreshed.price_amount == 1500.0


def test_ingest_updates_status_flags(db, raw_listing, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    sf = _make_search_filter(db)

    ingest_listings(db, sf, _normalized([raw_listing]))

    sold_version = dict(raw_listing)
    sold_version["isSold"] = True
    sold_version["isLive"] = False

    ingest_listings(db, sf, _normalized([sold_version]))

    refreshed = db.query(Listing).filter_by(fb_listing_id=raw_listing["id"]).one()
    assert refreshed.is_sold is True
    assert refreshed.is_live is False


def test_ingest_does_not_null_out_fields_missing_from_a_later_provider(db, raw_listing, monkeypatch):
    """A listing first seen via a provider that returns postal_code, then
    re-seen via one that doesn't, should keep its original postal_code rather
    than having it overwritten with None."""
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    sf = _make_search_filter(db)

    ingest_listings(db, sf, _normalized([raw_listing]))

    sparser = normalize_listing(raw_listing)
    sparser["postal_code"] = None

    ingest_listings(db, sf, [sparser])

    refreshed = db.query(Listing).filter_by(fb_listing_id=raw_listing["id"]).one()
    assert refreshed.postal_code == "27893-3516"
