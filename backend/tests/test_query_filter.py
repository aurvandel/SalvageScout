import pytest

from app.scraper.query_filter import matches_query, resolve_query


class MockSearchFilter:
    """Mock SearchFilter that doesn't require database connection."""

    def __init__(self, search_mode, location=None, query=None, search_url=None):
        self.search_mode = search_mode
        self.location = location
        self.query = query
        self.search_url = search_url


class TestResolveQuery:
    def test_location_mode_with_query(self):
        """Location mode uses search_filter.query directly."""
        sf = MockSearchFilter(
            search_mode="location", location="12345", query="truck"
        )
        assert resolve_query(sf) == "truck"

    def test_url_mode_parses_query_parameter(self):
        """URL mode extracts 'query' parameter from the URL."""
        sf = MockSearchFilter(
            search_mode="url",
            search_url="https://www.facebook.com/marketplace/109526612406787/search?maxPrice=1500&query=car&exact=false",
        )
        assert resolve_query(sf) == "car"

    def test_url_mode_no_query_parameter(self):
        """URL with no query parameter returns None."""
        sf = MockSearchFilter(
            search_mode="url",
            search_url="https://www.facebook.com/marketplace/109526612406787/search?maxPrice=1500",
        )
        assert resolve_query(sf) is None

    def test_location_mode_no_query_returns_none(self):
        """Location mode with no query returns None."""
        sf = MockSearchFilter(search_mode="location", location="12345")
        assert resolve_query(sf) is None


class TestMatchesQuery:
    @pytest.fixture
    def sf_url_car(self):
        """Search filter for 'car' via URL mode."""
        return MockSearchFilter(
            search_mode="url",
            search_url="https://www.facebook.com/marketplace/109526612406787/search?maxPrice=1500&query=car&exact=false",
        )

    @pytest.fixture
    def sf_location_car(self):
        """Search filter for 'car' via location mode."""
        return MockSearchFilter(
            search_mode="location", location="12345", query="car"
        )

    @pytest.fixture
    def sf_no_query(self):
        """Search filter with no query (should pass everything)."""
        return MockSearchFilter(search_mode="url", search_url="/some/url")

    def _make_listing(self, title: str) -> dict:
        """Helper to create a raw listing with a title."""
        return {"id": "123", "listingTitle": title}

    # Positive cases: should match "car" query
    def test_car_query_matches_sedan(self, sf_url_car):
        """'car' query matches sedan title."""
        item = self._make_listing("2015 Honda Civic · Sedan · 120K miles")
        assert matches_query(item, sf_url_car) is True

    def test_car_query_matches_suv(self, sf_url_car):
        """'car' query matches SUV title."""
        item = self._make_listing("2015 Toyota RAV4 · SUV · 80K miles")
        assert matches_query(item, sf_url_car) is True

    def test_car_query_matches_truck(self, sf_url_car):
        """'car' query matches truck title."""
        item = self._make_listing("2018 Ford F-150 · Pickup Truck · 45K miles")
        assert matches_query(item, sf_url_car) is True

    def test_car_query_matches_generic_vehicle_title(self, sf_url_car):
        """'car' query matches generic vehicle title with year/make/model."""
        item = self._make_listing("2003 Ford Crown Victoria · LX Sedan 4D")
        assert matches_query(item, sf_url_car) is True

    # Negative cases: should NOT match "car" query
    def test_car_query_rejects_motorcycle(self, sf_url_car):
        """'car' query rejects motorcycle title."""
        item = self._make_listing("2015 Harley-Davidson Sportster Motorcycle")
        assert matches_query(item, sf_url_car) is False

    def test_car_query_rejects_bike(self, sf_url_car):
        """'car' query rejects bike title."""
        item = self._make_listing("Trek Mountain Bike · 21 speed")
        assert matches_query(item, sf_url_car) is False

    def test_car_query_rejects_boat(self, sf_url_car):
        """'car' query rejects boat title."""
        item = self._make_listing("2015 Bayliner Sailboat")
        assert matches_query(item, sf_url_car) is False

    def test_car_query_rejects_canoe(self, sf_url_car):
        """'car' query rejects canoe title."""
        item = self._make_listing("Vintage Wood Canoe")
        assert matches_query(item, sf_url_car) is False

    def test_car_query_rejects_atv(self, sf_url_car):
        """'car' query rejects ATV title."""
        item = self._make_listing("2020 Honda TRX ATV")
        assert matches_query(item, sf_url_car) is False

    def test_car_query_rejects_trailer(self, sf_url_car):
        """'car' query rejects trailer title."""
        item = self._make_listing("2018 Car Trailer · 2000 lbs")
        assert matches_query(item, sf_url_car) is False

    # No query: pass through
    def test_no_query_passes_everything(self, sf_no_query):
        """No query specified means pass everything through."""
        assert matches_query(self._make_listing("2015 Honda Civic"), sf_no_query) is True
        assert matches_query(self._make_listing("Trek Mountain Bike"), sf_no_query) is True
        assert matches_query(self._make_listing("2015 Bayliner Sailboat"), sf_no_query) is True

    def test_empty_title_passes_through(self, sf_url_car):
        """Missing or empty title passes through (no filter rejection)."""
        assert matches_query({"id": "123"}, sf_url_car) is True
        assert matches_query({"id": "123", "listingTitle": ""}, sf_url_car) is True

    # Edge cases
    def test_case_insensitive_exclusion(self, sf_url_car):
        """Exclusion keywords are case-insensitive."""
        item = self._make_listing("2015 MOTORCYCLE HARLEY")
        assert matches_query(item, sf_url_car) is False

    def test_case_insensitive_category_matching(self, sf_url_car):
        """Category matching is case-insensitive."""
        item = self._make_listing("2015 Honda SEDAN")
        assert matches_query(item, sf_url_car) is True

    def test_truck_category_query(self):
        """Query for 'truck' only matches trucks, not general vehicles."""
        sf = MockSearchFilter(
            search_mode="location", location="12345", query="truck"
        )
        # Truck should match
        assert matches_query(self._make_listing("2018 Ford F-150 Truck"), sf) is True
        # Sedan should not match (no 'truck' keyword)
        assert matches_query(self._make_listing("2015 Honda Civic Sedan"), sf) is False

    def test_partial_keyword_in_word_matches(self):
        """'bike' keyword appears within 'mountain bike' — should reject."""
        sf = MockSearchFilter(
            search_mode="location", location="12345", query="car"
        )
        item = self._make_listing("Mountain Bike")
        # 'bike' is in the title, should be excluded
        assert matches_query(item, sf) is False

    def test_boat_in_description_does_not_filter(self):
        """Title doesn't contain 'boat' keyword, so it passes even if description mentions boats."""
        sf = MockSearchFilter(
            search_mode="location", location="12345", query="car"
        )
        # Title is a valid car; we only check the title, not description
        item = self._make_listing("2015 Honda Civic Sedan")
        assert matches_query(item, sf) is True
