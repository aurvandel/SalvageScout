from app.models import Listing, SearchFilter
from app.scraper import service


def test_run_scrape_fetches_and_ingests(db, raw_listings, mocker, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    mocker.patch("app.scraper.service.fetch_listings", return_value=raw_listings)

    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)

    touched = service.run_scrape(db, sf, results_limit=10)

    assert len(touched) == 3
    assert db.query(Listing).count() == 3
    service.fetch_listings.assert_called_once_with(sf.search_url, 10)
