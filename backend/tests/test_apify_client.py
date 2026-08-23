from unittest.mock import MagicMock

from app.scraper.apify_client import ACTOR_ID, fetch_listings


def test_fetch_listings_calls_actor_with_expected_input(mocker):
    mock_client = MagicMock()
    mock_run = MagicMock(default_dataset_id="dataset123")
    mock_client.actor.return_value.call.return_value = mock_run
    mock_client.dataset.return_value.iterate_items.return_value = iter([{"id": "1"}, {"id": "2"}])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    result = fetch_listings("https://www.facebook.com/marketplace/x/search/?query=sedan", results_limit=10)

    mock_client.actor.assert_called_once_with(ACTOR_ID)
    mock_client.actor.return_value.call.assert_called_once_with(
        run_input={
            "startUrls": [{"url": "https://www.facebook.com/marketplace/x/search/?query=sedan"}],
            "resultsLimit": 10,
            "includeListingDetails": True,
        }
    )
    mock_client.dataset.assert_called_once_with("dataset123")
    assert result == [{"id": "1"}, {"id": "2"}]


def test_fetch_listings_can_disable_details(mocker):
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = MagicMock(default_dataset_id="d")
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    mocker.patch("app.scraper.apify_client.ApifyClient", return_value=mock_client)

    fetch_listings("https://example.com", results_limit=5, include_details=False)

    call_kwargs = mock_client.actor.return_value.call.call_args.kwargs
    assert call_kwargs["run_input"]["includeListingDetails"] is False
