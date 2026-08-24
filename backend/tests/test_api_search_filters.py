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


def test_create_location_mode_search_filter(client):
    payload = {
        "name": "sedans in NYC",
        "search_mode": "location",
        "location": "newyork",
        "query": "sedan",
        "min_price": 1000,
        "max_price": 5000,
    }

    response = client.post("/api/search-filters", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["search_mode"] == "location"
    assert body["location"] == "newyork"
    assert body["min_price"] == 1000


def test_create_url_mode_without_search_url_rejected(client):
    response = client.post("/api/search-filters", json={"name": "x", "search_mode": "url"})
    assert response.status_code == 422


def test_create_location_mode_without_location_rejected(client):
    response = client.post("/api/search-filters", json={"name": "x", "search_mode": "location"})
    assert response.status_code == 422


def test_delete_search_filter(client):
    created = client.post(
        "/api/search-filters", json={"name": "to delete", "search_url": "https://example.com/1"}
    ).json()

    delete_response = client.delete(f"/api/search-filters/{created['id']}")
    assert delete_response.status_code == 204

    list_response = client.get("/api/search-filters")
    assert created["id"] not in [sf["id"] for sf in list_response.json()]


def test_delete_search_filter_not_found(client):
    response = client.delete("/api/search-filters/999999")
    assert response.status_code == 404
