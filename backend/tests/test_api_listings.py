from app.models import CriteriaProfile, Listing, ListingImage, Score


def _make_listing(db, fb_listing_id, **overrides):
    defaults = dict(
        fb_listing_id=fb_listing_id,
        url=f"https://example.com/{fb_listing_id}",
        title="2014 Chevrolet Impala",
        price_amount=2500.0,
        raw_apify_data={},
    )
    defaults.update(overrides)
    listing = Listing(**defaults)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _make_score(db, listing, match_score, **overrides):
    profile = CriteriaProfile(name="default", prompt_text="Score this car.")
    db.add(profile)
    db.commit()
    db.refresh(profile)

    defaults = dict(
        listing_id=listing.id,
        criteria_profile_id=profile.id,
        match_score=match_score,
        summary="summary",
        pros=[],
        cons=[],
        dealbreaker_flags=[],
        model_used="claude-haiku-4-5",
    )
    defaults.update(overrides)
    score = Score(**defaults)
    db.add(score)
    db.commit()
    return score


def test_list_listings_empty(client):
    response = client.get("/api/listings")
    assert response.status_code == 200
    assert response.json() == {"items": [], "has_more": False}


def test_list_listings_orders_by_best_score_desc(db, client):
    low = _make_listing(db, "low")
    high = _make_listing(db, "high")
    _make_score(db, low, 40)
    _make_score(db, high, 90)

    response = client.get("/api/listings")

    ids = [item["fb_listing_id"] for item in response.json()["items"]]
    assert ids == ["high", "low"]


def test_list_listings_unscored_appear_last(db, client):
    scored = _make_listing(db, "scored")
    unscored = _make_listing(db, "unscored")
    _make_score(db, scored, 60)

    response = client.get("/api/listings")

    ids = [item["fb_listing_id"] for item in response.json()["items"]]
    assert ids == ["scored", "unscored"]


def test_list_listings_min_score_filter(db, client):
    low = _make_listing(db, "low")
    high = _make_listing(db, "high")
    _make_score(db, low, 40)
    _make_score(db, high, 90)

    response = client.get("/api/listings", params={"min_score": 70})

    ids = [item["fb_listing_id"] for item in response.json()["items"]]
    assert ids == ["high"]


def test_list_listings_pagination(db, client):
    for i in range(5):
        _make_listing(db, f"listing-{i}")

    first_page = client.get("/api/listings", params={"limit": 2, "offset": 0}).json()
    assert len(first_page["items"]) == 2
    assert first_page["has_more"] is True

    second_page = client.get("/api/listings", params={"limit": 2, "offset": 2}).json()
    assert len(second_page["items"]) == 2
    assert second_page["has_more"] is True

    third_page = client.get("/api/listings", params={"limit": 2, "offset": 4}).json()
    assert len(third_page["items"]) == 1
    assert third_page["has_more"] is False

    seen_ids = {item["id"] for page in (first_page, second_page, third_page) for item in page["items"]}
    assert len(seen_ids) == 5


def test_list_listings_excludes_deleted_and_hidden(db, client):
    active = _make_listing(db, "active")
    hidden = _make_listing(db, "hidden", is_hidden=True)
    deleted = _make_listing(db, "deleted", is_deleted=True)

    response = client.get("/api/listings")

    ids = [item["fb_listing_id"] for item in response.json()["items"]]
    assert ids == ["active"]


def test_list_listings_view_hidden(db, client):
    _make_listing(db, "active")
    _make_listing(db, "hidden", is_hidden=True)
    _make_listing(db, "deleted", is_deleted=True)

    response = client.get("/api/listings", params={"view": "hidden"})

    ids = [item["fb_listing_id"] for item in response.json()["items"]]
    assert ids == ["hidden"]


def test_list_listings_view_favorites_excludes_hidden(db, client):
    _make_listing(db, "favorite", is_favorite=True)
    _make_listing(db, "favorite-and-hidden", is_favorite=True, is_hidden=True)
    _make_listing(db, "not-favorite")

    response = client.get("/api/listings", params={"view": "favorites"})

    ids = [item["fb_listing_id"] for item in response.json()["items"]]
    assert ids == ["favorite"]


def test_set_favorite(db, client):
    listing = _make_listing(db, "to-favorite")

    response = client.patch(f"/api/listings/{listing.id}/favorite", params={"favorite": True})
    assert response.status_code == 200
    assert response.json()["is_favorite"] is True

    response = client.patch(f"/api/listings/{listing.id}/favorite", params={"favorite": False})
    assert response.json()["is_favorite"] is False


def test_set_hidden(db, client):
    listing = _make_listing(db, "to-hide")

    response = client.patch(f"/api/listings/{listing.id}/hide", params={"hidden": True})
    assert response.status_code == 200
    assert response.json()["is_hidden"] is True

    active_ids = [item["fb_listing_id"] for item in client.get("/api/listings").json()["items"]]
    assert "to-hide" not in active_ids

    response = client.patch(f"/api/listings/{listing.id}/hide", params={"hidden": False})
    assert response.json()["is_hidden"] is False
    active_ids = [item["fb_listing_id"] for item in client.get("/api/listings").json()["items"]]
    assert "to-hide" in active_ids


def test_delete_listing_soft_deletes(db, client):
    listing = _make_listing(db, "to-delete")

    response = client.delete(f"/api/listings/{listing.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["is_deleted"] is True
    assert body["deleted_at"] is not None

    for view in ("active", "hidden", "favorites"):
        ids = [item["fb_listing_id"] for item in client.get("/api/listings", params={"view": view}).json()["items"]]
        assert "to-delete" not in ids


def test_delete_listing_survives_reingest(db, client, raw_listing):
    """A soft-deleted listing must not reappear once ingest_listings() re-upserts
    the same fb_listing_id on a later scrape."""
    from app.models import SearchFilter
    from app.scraper.ingest import ingest_listings

    search_filter = SearchFilter(name="test", search_url="https://example.com")
    db.add(search_filter)
    db.commit()
    db.refresh(search_filter)

    listing = _make_listing(db, raw_listing["id"])
    client.delete(f"/api/listings/{listing.id}")

    ingest_listings(db, search_filter, [raw_listing])

    refreshed = db.get(type(listing), listing.id)
    assert refreshed.is_deleted is True

    active_ids = [item["fb_listing_id"] for item in client.get("/api/listings").json()["items"]]
    assert raw_listing["id"] not in active_ids


def test_get_listing_detail_includes_scores(db, client):
    listing = _make_listing(db, "detail-test")
    _make_score(db, listing, 75, summary="Nice find.")

    response = client.get(f"/api/listings/{listing.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["fb_listing_id"] == "detail-test"
    assert len(body["scores"]) == 1
    assert body["scores"][0]["summary"] == "Nice find."


def test_get_listing_not_found(client):
    response = client.get("/api/listings/999999")
    assert response.status_code == 404


def test_listing_image_url_derived_from_local_path(db, client):
    listing = _make_listing(db, "with-image")
    db.add(ListingImage(listing_id=listing.id, local_path="data/images/with-image/0.jpg", position=0))
    db.commit()

    response = client.get(f"/api/listings/{listing.id}")

    assert response.json()["images"][0]["image_url"] == "/media/with-image/0.jpg"


def test_listing_image_url_survives_storage_dir_drift(db, client):
    # local_path prefix doesn't have to match the *current* image_storage_dir
    # setting (e.g. a row written under a different config) — image_url should
    # still resolve from the fb_listing_id/file segments rather than raising.
    listing = _make_listing(db, "drifted")
    db.add(
        ListingImage(
            listing_id=listing.id,
            local_path="/some/other/root/drifted/2.jpg",
            position=2,
        )
    )
    db.commit()

    response = client.get(f"/api/listings/{listing.id}")

    assert response.status_code == 200
    assert response.json()["images"][0]["image_url"] == "/media/drifted/2.jpg"
