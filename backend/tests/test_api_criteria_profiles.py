def test_create_criteria_profile_assigns_version(client):
    first = client.post("/api/criteria-profiles", json={"name": "v1", "prompt_text": "Score cars."}).json()
    second = client.post("/api/criteria-profiles", json={"name": "v2", "prompt_text": "Score cars better."}).json()

    assert first["version"] == 1
    assert second["version"] == 2


def test_creating_active_profile_deactivates_previous(client):
    first = client.post(
        "/api/criteria-profiles", json={"name": "v1", "prompt_text": "A", "is_active": True}
    ).json()
    client.post("/api/criteria-profiles", json={"name": "v2", "prompt_text": "B", "is_active": True})

    profiles = {p["id"]: p for p in client.get("/api/criteria-profiles").json()}
    assert profiles[first["id"]]["is_active"] is False


def test_creating_inactive_profile_does_not_disturb_active_one(client):
    first = client.post(
        "/api/criteria-profiles", json={"name": "v1", "prompt_text": "A", "is_active": True}
    ).json()
    client.post("/api/criteria-profiles", json={"name": "draft", "prompt_text": "B", "is_active": False})

    profiles = {p["id"]: p for p in client.get("/api/criteria-profiles").json()}
    assert profiles[first["id"]]["is_active"] is True


def test_activate_switches_active_profile(client):
    first = client.post(
        "/api/criteria-profiles", json={"name": "v1", "prompt_text": "A", "is_active": True}
    ).json()
    second = client.post(
        "/api/criteria-profiles", json={"name": "v2", "prompt_text": "B", "is_active": False}
    ).json()

    response = client.post(f"/api/criteria-profiles/{second['id']}/activate")
    assert response.status_code == 200
    assert response.json()["is_active"] is True

    profiles = {p["id"]: p for p in client.get("/api/criteria-profiles").json()}
    assert profiles[first["id"]]["is_active"] is False
    assert profiles[second["id"]]["is_active"] is True


def test_activate_not_found(client):
    response = client.post("/api/criteria-profiles/999999/activate")
    assert response.status_code == 404
