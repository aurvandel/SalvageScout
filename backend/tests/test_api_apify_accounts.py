def test_create_and_list_apify_accounts(client):
    payload = {"label": "Parker's account", "api_token": "token-1234"}

    create_response = client.post("/api/apify-accounts", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["label"] == "Parker's account"
    assert created["is_active"] is True
    assert created["priority"] == 100
    assert "1234" in created["api_token_masked"]
    assert "token-1234" not in create_response.text

    list_response = client.get("/api/apify-accounts")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_create_without_token_rejected(client):
    response = client.post("/api/apify-accounts", json={"label": "no token"})
    assert response.status_code == 422


def test_create_without_label_rejected(client):
    response = client.post("/api/apify-accounts", json={"api_token": "t1"})
    assert response.status_code == 422


def test_list_orders_by_priority_then_id(client):
    client.post("/api/apify-accounts", json={"label": "second", "api_token": "t1", "priority": 200})
    client.post("/api/apify-accounts", json={"label": "first", "api_token": "t2", "priority": 100})

    response = client.get("/api/apify-accounts")

    assert [a["label"] for a in response.json()] == ["first", "second"]


def test_update_label_does_not_require_token(client):
    created = client.post("/api/apify-accounts", json={"label": "old label", "api_token": "keep-me-1234"}).json()

    response = client.patch(f"/api/apify-accounts/{created['id']}", json={"label": "new label"})

    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "new label"
    assert "1234" in body["api_token_masked"]


def test_update_does_not_overwrite_token_with_masked_placeholder(client):
    # Regression: the frontend round-trips the masked value ("****1234") into
    # the label-only edit form's hidden token field must never persist that
    # placeholder as the real token — only a non-empty api_token in the
    # payload should replace what's stored.
    created = client.post("/api/apify-accounts", json={"label": "acct", "api_token": "real-token-1234"}).json()

    client.patch(f"/api/apify-accounts/{created['id']}", json={"label": "acct", "api_token": ""})
    unchanged = client.get("/api/apify-accounts").json()[0]
    assert "1234" in unchanged["api_token_masked"]

    client.patch(f"/api/apify-accounts/{created['id']}", json={"label": "acct", "api_token": "new-token-5678"})
    changed = client.get("/api/apify-accounts").json()[0]
    assert "5678" in changed["api_token_masked"]


def test_update_active_flag_alone_without_label(client):
    # Regression: this is exactly the payload the admin UI's inline Active
    # checkbox sends — label must not be required on a partial PATCH.
    created = client.post("/api/apify-accounts", json={"label": "acct", "api_token": "t1"}).json()

    response = client.patch(f"/api/apify-accounts/{created['id']}", json={"is_active": False})

    assert response.status_code == 200
    body = response.json()
    assert body["is_active"] is False
    assert body["label"] == "acct"


def test_update_priority_and_active_flag(client):
    created = client.post("/api/apify-accounts", json={"label": "acct", "api_token": "t1"}).json()

    response = client.patch(
        f"/api/apify-accounts/{created['id']}", json={"label": "acct", "priority": 5, "is_active": False}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["priority"] == 5
    assert body["is_active"] is False


def test_update_not_found(client):
    response = client.patch("/api/apify-accounts/999999", json={"label": "x"})
    assert response.status_code == 404


def test_delete_apify_account(client):
    created = client.post("/api/apify-accounts", json={"label": "to delete", "api_token": "t1"}).json()

    delete_response = client.delete(f"/api/apify-accounts/{created['id']}")
    assert delete_response.status_code == 204

    list_response = client.get("/api/apify-accounts")
    assert created["id"] not in [a["id"] for a in list_response.json()]


def test_delete_not_found(client):
    response = client.delete("/api/apify-accounts/999999")
    assert response.status_code == 404
