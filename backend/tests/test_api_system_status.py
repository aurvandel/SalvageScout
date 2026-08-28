from app.models import ApifyAccount
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


def test_scraper_not_configured_when_no_apify_accounts(client, db, mocker):
    mocker.patch("app.settings_service.env_settings.apify_token", None)

    response = client.get("/api/admin/system-status")

    assert response.status_code == 200
    apify_rows = [row for row in response.json()["scrapers"] if row["provider"] == "apify"]
    assert len(apify_rows) == 1
    assert apify_rows[0]["configured"] is False
    assert apify_rows[0]["status"] == "not_configured"


def test_scraper_connected_when_check_succeeds(client, db, mocker):
    db.add(ApifyAccount(label="Test Account", api_token="fake-apify-token"))
    db.commit()
    mocker.patch("app.api.admin.get_account_usage", return_value={})

    response = client.get("/api/admin/system-status")

    apify_rows = [row for row in response.json()["scrapers"] if row["provider"] == "apify"]
    assert len(apify_rows) == 1
    assert apify_rows[0]["configured"] is True
    assert apify_rows[0]["status"] == "connected"
    assert apify_rows[0]["label"] == "Test Account"


def test_scraper_fails_over_reports_one_row_per_apify_account(client, db, mocker):
    db.add(ApifyAccount(label="Good", api_token="good-token"))
    db.add(ApifyAccount(label="Bad", api_token="bad-token"))
    db.commit()

    def _fake_check(token):
        if token != "good-token":
            raise RuntimeError("boom")

    mocker.patch("app.api.admin.get_account_usage", side_effect=_fake_check)

    response = client.get("/api/admin/system-status")

    apify_rows = {row["label"]: row for row in response.json()["scrapers"] if row["provider"] == "apify"}
    assert apify_rows["Good"]["status"] == "connected"
    assert apify_rows["Bad"]["status"] == "error"
    assert apify_rows["Bad"]["error"] == "boom"


def test_scraper_error_when_check_raises(client, mocker):
    client.patch("/api/admin/settings/scraper", json={"scrape_creators_api_key": "fake-key"})
    mocker.patch("app.api.admin.get_scrape_creators_usage", side_effect=RuntimeError("boom"))

    response = client.get("/api/admin/system-status")

    scrapers = {row["provider"]: row for row in response.json()["scrapers"]}
    assert scrapers["scrape_creators"]["configured"] is True
    assert scrapers["scrape_creators"]["status"] == "error"
    assert scrapers["scrape_creators"]["error"] == "boom"
