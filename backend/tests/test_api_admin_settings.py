def test_get_settings_returns_all_groups(client):
    response = client.get("/api/admin/settings")

    assert response.status_code == 200
    body = response.json()
    assert "llm" in body
    assert "apify" in body
    assert "scraper" in body
    assert "notifications" in body
    assert body["llm"]["provider"] in body["llm"]["available_providers"]
    assert body["scraper"]["provider"] in body["scraper"]["available_providers"]


def test_patch_llm_settings_updates_provider_and_model(client):
    response = client.patch("/api/admin/settings/llm", json={"provider": "openai", "model": "gpt-4o-mini"})

    assert response.status_code == 200
    body = response.json()
    assert body["llm"]["provider"] == "openai"
    assert body["llm"]["model"] == "gpt-4o-mini"


def test_patch_llm_settings_rejects_unknown_provider(client):
    response = client.patch("/api/admin/settings/llm", json={"provider": "slack"})
    assert response.status_code == 400


def test_patch_llm_settings_rejects_model_not_in_provider(client):
    response = client.patch("/api/admin/settings/llm", json={"provider": "anthropic", "model": "gpt-4o-mini"})
    assert response.status_code == 400


def test_patch_llm_settings_masks_api_key(client):
    response = client.patch("/api/admin/settings/llm", json={"anthropic_api_key": "sk-ant-abcd1234"})

    assert response.status_code == 200
    masked = response.json()["llm"]["anthropic_api_key_masked"]
    assert masked is not None
    assert "1234" in masked
    assert "sk-ant-abcd1234" not in masked


def test_patch_llm_settings_leaves_unspecified_fields_unchanged(client):
    client.patch("/api/admin/settings/llm", json={"provider": "openai"})
    response = client.patch("/api/admin/settings/llm", json={"model": "gpt-4o"})

    assert response.json()["llm"]["provider"] == "openai"
    assert response.json()["llm"]["model"] == "gpt-4o"


def test_patch_apify_settings(client):
    response = client.patch(
        "/api/admin/settings/apify", json={"apify_token": "fake-token-1234", "actor_id": "custom/actor"}
    )

    assert response.status_code == 200
    body = response.json()["apify"]
    assert body["actor_id"] == "custom/actor"
    assert "1234" in body["apify_token_masked"]


def test_patch_scraper_settings_switches_provider(client):
    response = client.patch(
        "/api/admin/settings/scraper",
        json={"provider": "scrape_creators", "scrape_creators_api_key": "sc-fake-1234"},
    )

    assert response.status_code == 200
    body = response.json()["scraper"]
    assert body["provider"] == "scrape_creators"
    assert "1234" in body["scrape_creators_api_key_masked"]


def test_patch_scraper_settings_rejects_unknown_provider(client):
    response = client.patch("/api/admin/settings/scraper", json={"provider": "not-a-real-provider"})
    assert response.status_code == 400


def test_patch_scraper_settings_flags_incompatible_url_mode_filters(client):
    client.post(
        "/api/search-filters",
        json={"name": "raw url filter", "search_mode": "url", "search_url": "https://example.com/search"},
    )

    response = client.patch("/api/admin/settings/scraper", json={"provider": "scrape_creators"})

    assert response.status_code == 200
    assert "raw url filter" in response.json()["scraper"]["incompatible_filter_names"]


def test_patch_scraper_settings_bright_data_does_not_flag_url_mode_filters(client):
    # Unlike ScrapeCreators, Bright Data's scraper takes a real Marketplace
    # search URL as input, so url-mode filters run fine under it.
    client.post(
        "/api/search-filters",
        json={"name": "raw url filter", "search_mode": "url", "search_url": "https://example.com/search"},
    )

    response = client.patch("/api/admin/settings/scraper", json={"provider": "bright_data"})

    assert response.status_code == 200
    assert response.json()["scraper"]["incompatible_filter_names"] == []


def test_patch_notification_settings_toggles_channels(client):
    response = client.patch(
        "/api/admin/settings/notifications",
        json={"discord_enabled": False, "telegram_enabled": True, "notification_score_threshold": 80},
    )

    assert response.status_code == 200
    body = response.json()["notifications"]
    assert body["discord_enabled"] is False
    assert body["telegram_enabled"] is True
    assert body["notification_score_threshold"] == 80


def test_patch_notification_settings_updates_webhook(client):
    response = client.patch(
        "/api/admin/settings/notifications",
        json={"discord_webhook_url": "https://discord.com/api/webhooks/x/y"},
    )

    assert response.status_code == 200
    assert response.json()["notifications"]["discord_webhook_url_masked"] is not None
