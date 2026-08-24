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
    assert response.json() == []


def test_list_listings_orders_by_best_score_desc(db, client):
    low = _make_listing(db, "low")
    high = _make_listing(db, "high")
    _make_score(db, low, 40)
    _make_score(db, high, 90)

    response = client.get("/api/listings")

    ids = [item["fb_listing_id"] for item in response.json()]
    assert ids == ["high", "low"]


def test_list_listings_unscored_appear_last(db, client):
    scored = _make_listing(db, "scored")
    unscored = _make_listing(db, "unscored")
    _make_score(db, scored, 60)

    response = client.get("/api/listings")

    ids = [item["fb_listing_id"] for item in response.json()]
    assert ids == ["scored", "unscored"]


def test_list_listings_min_score_filter(db, client):
    low = _make_listing(db, "low")
    high = _make_listing(db, "high")
    _make_score(db, low, 40)
    _make_score(db, high, 90)

    response = client.get("/api/listings", params={"min_score": 70})

    ids = [item["fb_listing_id"] for item in response.json()]
    assert ids == ["high"]


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
