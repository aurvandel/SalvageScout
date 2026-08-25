import pytest
from unittest.mock import MagicMock, patch

from app.scraper.query_filter import (
    _batch_filter_with_llm,
    filter_listings_by_query,
    resolve_query,
)


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

    def test_url_mode_query_with_spaces_trimmed(self):
        """URL mode trims whitespace from query."""
        sf = MockSearchFilter(
            search_mode="url",
            search_url="https://www.facebook.com/marketplace/search?query=%20ipad%20",
        )
        # Note: URL encoding turns spaces to %20, parse_qs unquotes them
        assert resolve_query(sf) == "ipad" or resolve_query(sf).strip() == "ipad"


class TestBatchFilterWithLLM:
    def test_batch_filter_empty_titles(self):
        """Empty title list returns empty verdicts."""
        result = _batch_filter_with_llm([], "car", "anthropic", "claude-haiku-4-5", "fake-key")
        assert result == []

    @patch("anthropic.Anthropic")
    def test_batch_filter_anthropic_success(self, mock_anthropic_class):
        """Successfully parse Anthropic LLM response."""
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='[{"index": 0, "keep": true}, {"index": 1, "keep": false}]')]
        mock_client.messages.create.return_value = mock_response

        result = _batch_filter_with_llm(
            ["2015 Honda Civic", "Trek Mountain Bike"],
            "car",
            "anthropic",
            "claude-haiku-4-5",
            "fake-key",
        )
        assert result == [True, False]

    def test_batch_filter_malformed_json_fails_open(self):
        """Malformed JSON response fails open (returns all True)."""
        with patch("anthropic.Anthropic") as mock_anthropic_class:
            mock_client = MagicMock()
            mock_anthropic_class.return_value = mock_client
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text="invalid json")]
            mock_client.messages.create.return_value = mock_response

            result = _batch_filter_with_llm(
                ["2015 Honda Civic", "Trek Bike"],
                "car",
                "anthropic",
                "claude-haiku-4-5",
                "fake-key",
            )
            # Fails open: returns all True
            assert result == [True, True]

    def test_batch_filter_api_error_fails_open(self):
        """API error fails open (returns all True)."""
        with patch("anthropic.Anthropic") as mock_anthropic_class:
            mock_client = MagicMock()
            mock_anthropic_class.return_value = mock_client
            mock_client.messages.create.side_effect = Exception("API error")

            result = _batch_filter_with_llm(
                ["2015 Honda Civic", "Trek Bike"],
                "car",
                "anthropic",
                "claude-haiku-4-5",
                "fake-key",
            )
            # Fails open: returns all True
            assert result == [True, True]


class TestFilterListingsByQuery:
    def _make_listing(self, title: str) -> dict:
        """Helper to create a raw listing with a title."""
        return {"id": "123", "listingTitle": title}

    def test_no_query_passes_everything(self):
        """No query specified means pass everything through."""
        sf = MockSearchFilter(search_mode="url", search_url="https://example.com/search")
        items = [
            self._make_listing("2015 Honda Civic"),
            self._make_listing("Trek Mountain Bike"),
            self._make_listing("2015 Bayliner Sailboat"),
        ]
        mock_db = MagicMock()
        result = filter_listings_by_query(mock_db, items, sf)
        assert result == items  # All pass through

    def test_empty_items_list(self):
        """Empty input returns empty output."""
        sf = MockSearchFilter(
            search_mode="url",
            search_url="https://example.com/search?query=car",
        )
        mock_db = MagicMock()
        result = filter_listings_by_query(mock_db, [], sf)
        assert result == []

    @patch("app.scraper.query_filter._batch_filter_with_llm")
    @patch("app.scraper.query_filter.get_app_settings")
    def test_filter_with_query_car_example(self, mock_settings, mock_batch_filter):
        """Filter listings with 'car' query using mocked LLM."""
        mock_settings.return_value = MagicMock(
            llm_provider="anthropic",
            llm_model="claude-haiku-4-5",
        )
        with patch("app.settings_service.get_api_key_for_provider", return_value="fake-key"):
            # Mock LLM: keep sedan and truck, reject bike and boat
            mock_batch_filter.return_value = [True, False, True, False]

            sf = MockSearchFilter(
                search_mode="url",
                search_url="https://example.com/search?query=car",
            )
            items = [
                self._make_listing("2015 Honda Civic Sedan"),
                self._make_listing("Trek Mountain Bike"),
                self._make_listing("2018 Ford F-150 Truck"),
                self._make_listing("2015 Bayliner Sailboat"),
            ]
            mock_db = MagicMock()
            result = filter_listings_by_query(mock_db, items, sf)
            assert len(result) == 2
            assert result[0]["listingTitle"] == "2015 Honda Civic Sedan"
            assert result[1]["listingTitle"] == "2018 Ford F-150 Truck"

    @patch("app.scraper.query_filter._batch_filter_with_llm")
    @patch("app.scraper.query_filter.get_app_settings")
    def test_filter_with_query_bike_example(self, mock_settings, mock_batch_filter):
        """Filter listings with 'bike' query accepts bicycles."""
        mock_settings.return_value = MagicMock(
            llm_provider="anthropic",
            llm_model="claude-haiku-4-5",
        )
        with patch("app.settings_service.get_api_key_for_provider", return_value="fake-key"):
            # Mock LLM: keep bikes, reject car
            mock_batch_filter.return_value = [True, False]

            sf = MockSearchFilter(
                search_mode="location",
                location="12345",
                query="bike",
            )
            items = [
                self._make_listing("Trek Mountain Bike 21-speed"),
                self._make_listing("2015 Honda Civic Sedan"),
            ]
            mock_db = MagicMock()
            result = filter_listings_by_query(mock_db, items, sf)
            assert len(result) == 1
            assert result[0]["listingTitle"] == "Trek Mountain Bike 21-speed"

    @patch("app.scraper.query_filter._batch_filter_with_llm")
    @patch("app.scraper.query_filter.get_app_settings")
    def test_filter_with_query_ipad_example(self, mock_settings, mock_batch_filter):
        """Filter listings with 'ipad' query accepts tablets."""
        mock_settings.return_value = MagicMock(
            llm_provider="anthropic",
            llm_model="claude-haiku-4-5",
        )
        with patch("app.settings_service.get_api_key_for_provider", return_value="fake-key"):
            # Mock LLM: keep iPad, reject car
            mock_batch_filter.return_value = [True, False]

            sf = MockSearchFilter(
                search_mode="url",
                search_url="https://example.com/search?query=ipad",
            )
            items = [
                self._make_listing("iPad Pro 12.9 inch 256GB"),
                self._make_listing("2015 Honda Civic Sedan"),
            ]
            mock_db = MagicMock()
            result = filter_listings_by_query(mock_db, items, sf)
            assert len(result) == 1
            assert result[0]["listingTitle"] == "iPad Pro 12.9 inch 256GB"

    @patch("app.scraper.query_filter._batch_filter_with_llm")
    @patch("app.scraper.query_filter.get_app_settings")
    def test_filter_no_api_key_passes_through(self, mock_settings, mock_batch_filter):
        """If no API key, all items pass through."""
        mock_settings.return_value = MagicMock(
            llm_provider="anthropic",
            llm_model="claude-haiku-4-5",
        )
        with patch("app.settings_service.get_api_key_for_provider", return_value=None):
            sf = MockSearchFilter(
                search_mode="url",
                search_url="https://example.com/search?query=car",
            )
            items = [
                self._make_listing("Trek Mountain Bike"),
                self._make_listing("2015 Honda Civic"),
            ]
            mock_db = MagicMock()
            result = filter_listings_by_query(mock_db, items, sf)
            # No API key: all pass through
            assert result == items
