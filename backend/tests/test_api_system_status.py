from app.settings_service import get_app_settings


def test_llm_not_configured_when_no_key_set(client, db):
    config = get_app_settings(db)
    config.anthropic_api_key = None
    db.commit()

    response = client.get("/api/admin/system-status")

    assert response.status_code == 200
    llm = {row["provider"]: row for row in response.json()["llm"]}
    assert llm["anthropic"]["configured"] is False
    assert llm["anthropic"]["status"] == "not_configured"


def test_llm_connected_when_check_succeeds(client, mocker):
    client.patch("/api/admin/settings/llm", json={"anthropic_api_key": "fake-anthropic-key"})
    mocker.patch("app.api.admin.check_llm_connection")

    response = client.get("/api/admin/system-status")

    llm = {row["provider"]: row for row in response.json()["llm"]}
    assert llm["anthropic"]["configured"] is True
    assert llm["anthropic"]["status"] == "connected"
    assert llm["anthropic"]["error"] is None


def test_llm_error_when_check_raises(client, mocker):
    client.patch("/api/admin/settings/llm", json={"anthropic_api_key": "fake-anthropic-key"})
    mocker.patch("app.api.admin.check_llm_connection", side_effect=RuntimeError("invalid x-api-key"))

    response = client.get("/api/admin/system-status")

    llm = {row["provider"]: row for row in response.json()["llm"]}
    assert llm["anthropic"]["configured"] is True
    assert llm["anthropic"]["status"] == "error"
    assert llm["anthropic"]["error"] == "invalid x-api-key"


def test_scraper_not_configured_when_no_token_set(client, db):
    config = get_app_settings(db)
    config.apify_token = None
    db.commit()

    response = client.get("/api/admin/system-status")

    assert response.status_code == 200
    scrapers = {row["provider"]: row for row in response.json()["scrapers"]}
    assert scrapers["apify"]["configured"] is False
    assert scrapers["apify"]["status"] == "not_configured"


def test_scraper_connected_when_check_succeeds(client, mocker):
    client.patch("/api/admin/settings/apify", json={"apify_token": "fake-apify-token"})
    mocker.patch("app.api.admin.get_account_usage", return_value={})

    response = client.get("/api/admin/system-status")

    scrapers = {row["provider"]: row for row in response.json()["scrapers"]}
    assert scrapers["apify"]["configured"] is True
    assert scrapers["apify"]["status"] == "connected"


def test_scraper_error_when_check_raises(client, mocker):
    client.patch("/api/admin/settings/scraper", json={"scrape_creators_api_key": "fake-key"})
    mocker.patch("app.api.admin.get_scrape_creators_usage", side_effect=RuntimeError("boom"))

    response = client.get("/api/admin/system-status")

    scrapers = {row["provider"]: row for row in response.json()["scrapers"]}
    assert scrapers["scrape_creators"]["configured"] is True
    assert scrapers["scrape_creators"]["status"] == "error"
    assert scrapers["scrape_creators"]["error"] == "boom"
