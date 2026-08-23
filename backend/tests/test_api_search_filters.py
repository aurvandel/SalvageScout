def test_create_and_list_search_filters(client):
    payload = {"name": "sedans near me", "search_url": "https://www.facebook.com/marketplace/x/search/?query=sedan"}

    create_response = client.post("/api/search-filters", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "sedans near me"
    assert created["is_active"] is True

    list_response = client.get("/api/search-filters")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_update_search_filter(client):
    created = client.post(
        "/api/search-filters", json={"name": "old name", "search_url": "https://example.com/1"}
    ).json()

    response = client.patch(
        f"/api/search-filters/{created['id']}",
        json={"name": "new name", "search_url": "https://example.com/1", "is_active": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "new name"
    assert body["is_active"] is False


def test_update_search_filter_not_found(client):
    response = client.patch(
        "/api/search-filters/999999", json={"name": "x", "search_url": "https://example.com"}
    )
    assert response.status_code == 404
