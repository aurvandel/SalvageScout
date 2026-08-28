import pytest

from app.models import Listing, SearchFilter
from app.scraper import service
from app.scraper.normalize import normalize_listing
from app.settings_service import get_app_settings


def test_run_scrape_fetches_and_ingests(db, raw_listings, mocker, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    normalized = [normalize_listing(raw) for raw in raw_listings]
    fake_backend = mocker.Mock(return_value=normalized)
    get_scraper_mock = mocker.patch("app.scraper.service.get_scraper", return_value=fake_backend)

    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)

    result = service.run_scrape(db, sf, results_limit=10)

    assert len(result.listings) == 3
    assert result.new_count == 3
    assert db.query(Listing).count() == 3

    config = get_app_settings(db)
    get_scraper_mock.assert_called_once_with("apify")  # AppSettings.scraper_provider default
    fake_backend.assert_called_once_with(db, sf, 10, config)


def test_run_scrape_enriches_via_bright_data_when_enabled(db, raw_listings, mocker, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    normalized = [normalize_listing(raw) for raw in raw_listings]
    fake_backend = mocker.Mock(return_value=normalized)
    mocker.patch("app.scraper.service.get_scraper", return_value=fake_backend)
    enrich_mock = mocker.patch("app.scraper.service.enrich_listings", side_effect=lambda items, api_key: items)

    config = get_app_settings(db)
    config.bright_data_enrichment_enabled = True
    config.bright_data_api_key = "fake-bd-key"
    db.commit()

    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)

    service.run_scrape(db, sf, results_limit=10)

    enrich_mock.assert_called_once()
    assert enrich_mock.call_args.args[1] == "fake-bd-key"


def test_run_scrape_skips_enrichment_when_disabled(db, raw_listings, mocker, monkeypatch):
    monkeypatch.setattr("app.scraper.ingest.download_images", lambda fb_id, urls: [])
    normalized = [normalize_listing(raw) for raw in raw_listings]
    fake_backend = mocker.Mock(return_value=normalized)
    mocker.patch("app.scraper.service.get_scraper", return_value=fake_backend)
    enrich_mock = mocker.patch("app.scraper.service.enrich_listings")

    sf = SearchFilter(name="test", search_url="https://www.facebook.com/marketplace/x/search/?query=sedan")
    db.add(sf)
    db.commit()
    db.refresh(sf)

    service.run_scrape(db, sf, results_limit=10)

    enrich_mock.assert_not_called()


def test_run_scrape_rejects_url_mode_on_provider_without_url_support(db):
    config = get_app_settings(db)
    config.scraper_provider = "scrape_creators"
    db.commit()

    sf = SearchFilter(name="test", search_mode="url", search_url="https://www.facebook.com/marketplace/x/search/")
    db.add(sf)
    db.commit()
    db.refresh(sf)

    with pytest.raises(ValueError, match="scrape_creators"):
        service.run_scrape(db, sf, results_limit=10)
