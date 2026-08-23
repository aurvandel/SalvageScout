from app.scraper.normalize import extract_photo_urls, normalize_listing


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
    assert fields["raw_apify_data"] == raw_listing


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
