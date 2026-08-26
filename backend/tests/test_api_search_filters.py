from app.models import CriteriaProfile


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


def test_create_location_mode_with_lat_lng_but_no_location_text_allowed(client):
    # A "use my location" button fills lat/lng directly (see scrape_creators_backend's
    # geocode-cache short-circuit) — location text is only needed as a fallback
    # for geocoding, so it shouldn't be required when coordinates are already set.
    response = client.post(
        "/api/search-filters",
        json={"name": "near me", "search_mode": "location", "latitude": 30.2677, "longitude": -97.7475},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["latitude"] == 30.2677
    assert body["longitude"] == -97.7475
    assert body["location"] is None


def test_create_location_mode_without_location_or_coordinates_rejected(client):
    response = client.post(
        "/api/search-filters", json={"name": "x", "search_mode": "location", "latitude": 30.2677}
    )
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


def test_create_search_filter_with_linked_criteria_profile(client, db):
    profile = CriteriaProfile(name="iphones", prompt_text="Score iPhones.", is_active=False)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    response = client.post(
        "/api/search-filters",
        json={"name": "iphones", "search_url": "https://example.com/1", "criteria_profile_id": profile.id},
    )

    assert response.status_code == 201
    assert response.json()["criteria_profile_id"] == profile.id


def test_create_search_filter_with_unknown_criteria_profile_rejected(client):
    response = client.post(
        "/api/search-filters",
        json={"name": "x", "search_url": "https://example.com/1", "criteria_profile_id": 999999},
    )
    assert response.status_code == 404
