from app.scraper.normalize import extract_photo_urls, normalize_listing, normalize_listing_curious_coder


def test_normalize_listing_maps_core_fields(raw_listing):
    fields = normalize_listing(raw_listing)

    assert fields["fb_listing_id"] == "839387795495137"
    assert fields["url"] == "https://www.facebook.com/marketplace/item/839387795495137/"
    assert fields["title"] == "2003 Ford Crown Victoria · LX Sedan 4D"
    assert fields["price_amount"] == 2000.0
    assert fields["currency"] == "USD"
    assert fields["strikethrough_price_amount"] is None
    assert fields["condition"] == "USED"
    assert fields["is_live"] is True
    assert fields["is_pending"] is False
    assert fields["is_sold"] is False
    assert fields["location_text"] == "Wilson, NC"
    assert fields["postal_code"] == "27893-3516"
    assert fields["year"] == 2003
    assert fields["make"] == "Ford"
    assert fields["model"] == "Crown Victoria"
    assert fields["mileage"] == 215000
    assert fields["raw_scraper_data"] == raw_listing
    assert len(fields["photo_urls"]) == 11


def test_normalize_listing_parses_posted_at(raw_listing):
    fields = normalize_listing(raw_listing)
    assert fields["posted_at"].isoformat() == "2026-06-02T15:07:19+00:00"


def test_normalize_listing_strikethrough_price(raw_listings):
    lancer = next(item for item in raw_listings if item["id"] == "1055546550355048")
    fields = normalize_listing(lancer)
    assert fields["strikethrough_price_amount"] == 3000.0
    assert fields["price_amount"] == 2000.0


def test_normalize_listing_empty_description(raw_listings):
    impala = next(item for item in raw_listings if item["id"] == "870828679432174")
    fields = normalize_listing(impala)
    assert fields["description"] == ""


def test_normalize_listing_missing_optional_sections():
    # A minimal item missing location/description/price entirely shouldn't raise.
    minimal = {
        "id": "123",
        "itemUrl": "https://www.facebook.com/marketplace/item/123/",
        "listingTitle": "2020 Toyota Corolla",
    }
    fields = normalize_listing(minimal)
    assert fields["price_amount"] is None
    assert fields["currency"] is None
    assert fields["location_text"] is None
    assert fields["latitude"] is None
    assert fields["description"] is None
    assert fields["is_live"] is True  # Apify default when isLive is absent


def test_extract_photo_urls(raw_listing):
    urls = extract_photo_urls(raw_listing)
    assert len(urls) == 11
    assert all(url.startswith("https://") for url in urls)


def test_extract_photo_urls_no_photos():
    assert extract_photo_urls({"listingPhotos": []}) == []
    assert extract_photo_urls({}) == []


# Field names below follow curious_coder/facebook-marketplace's published docs,
# not a confirmed live sample (see CURIOUS_CODER_ACTOR_ID in apify_client.py).
def _curious_coder_raw(**overrides):
    raw = {
        "id": "839387795495137",
        "marketplace_listing_title": "2003 Ford Crown Victoria · LX Sedan 4D",
        "listing_price": {"amount": "2000", "currency": "USD"},
        "condition": "USED",
        "is_live": True,
        "is_sold": False,
        "location": {
            "latitude": 35.72,
            "longitude": -77.92,
            "reverse_geocode": {"city": "Wilson", "state": "NC"},
        },
        "vehicle_make_display_name": "Ford",
        "vehicle_model_display_name": "Crown Victoria",
        "vehicle_odometer_data": {"value": 215000, "unit": "MILES"},
        "redacted_description": {"text": "Runs great"},
        "listing_photos": [{"id": "1", "image": {"uri": "https://example.com/1.jpg"}}],
        "creation_time": 1748876839,
    }
    raw.update(overrides)
    return raw


def test_normalize_listing_curious_coder_maps_core_fields():
    fields = normalize_listing_curious_coder(_curious_coder_raw())

    assert fields["fb_listing_id"] == "839387795495137"
    assert fields["url"] == "https://www.facebook.com/marketplace/item/839387795495137/"
    assert fields["title"] == "2003 Ford Crown Victoria · LX Sedan 4D"
    assert fields["price_amount"] == 2000.0
    assert fields["currency"] == "USD"
    assert fields["condition"] == "USED"
    assert fields["is_live"] is True
    assert fields["is_sold"] is False
    assert fields["location_text"] == "Wilson, NC"
    assert fields["year"] == 2003
    assert fields["make"] == "Ford"
    assert fields["model"] == "Crown Victoria"
    assert fields["mileage"] == 215000
    assert fields["description"] == "Runs great"
    assert fields["photo_urls"] == ["https://example.com/1.jpg"]
    assert fields["posted_at"].isoformat() == "2025-06-02T15:07:19+00:00"


def test_normalize_listing_curious_coder_converts_km_odometer():
    raw = _curious_coder_raw(vehicle_odometer_data={"value": 100000, "unit": "KM"})
    fields = normalize_listing_curious_coder(raw)
    assert fields["mileage"] == 62137


def test_normalize_listing_curious_coder_falls_back_to_title_mileage():
    raw = _curious_coder_raw(vehicle_odometer_data=None, marketplace_listing_title="2018 Honda Civic 45K miles")
    fields = normalize_listing_curious_coder(raw)
    assert fields["mileage"] == 45000


def test_normalize_listing_curious_coder_missing_optional_sections():
    minimal = {"id": "123", "marketplace_listing_title": "2020 Toyota Corolla"}
    fields = normalize_listing_curious_coder(minimal)
    assert fields["fb_listing_id"] == "123"
    assert fields["url"] == "https://www.facebook.com/marketplace/item/123/"
    assert fields["price_amount"] is None
    assert fields["location_text"] is None
    assert fields["latitude"] is None
    assert fields["mileage"] is None
    assert fields["photo_urls"] == []
    assert fields["is_live"] is True


def test_normalize_listing_curious_coder_falls_back_to_primary_photo():
    raw = _curious_coder_raw(listing_photos=[], primary_listing_photo_url="https://example.com/primary.jpg")
    fields = normalize_listing_curious_coder(raw)
    assert fields["photo_urls"] == ["https://example.com/primary.jpg"]
