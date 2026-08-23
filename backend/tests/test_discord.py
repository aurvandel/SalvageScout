import httpx
import pytest
import respx

from app.models import Listing, Score
from app.notifier.discord import send


def _listing():
    return Listing(fb_listing_id="1", url="https://example.com/1", title="2014 Impala", price_amount=2500.0, raw_apify_data={})


def _score():
    return Score(match_score=85, summary="Good deal.", pros=[], cons=[], dealbreaker_flags=[], model_used="claude-haiku-4-5")


@respx.mock
def test_send_posts_to_configured_webhook(monkeypatch):
    monkeypatch.setattr("app.notifier.discord.settings.discord_webhook_url", "https://discord.com/api/webhooks/x/y")
    route = respx.post("https://discord.com/api/webhooks/x/y").mock(return_value=httpx.Response(204))

    send(_listing(), _score())

    assert route.called
    payload = route.calls.last.request.content
    assert b"2014 Impala" in payload


@respx.mock
def test_send_raises_on_http_error(monkeypatch):
    monkeypatch.setattr("app.notifier.discord.settings.discord_webhook_url", "https://discord.com/api/webhooks/x/y")
    respx.post("https://discord.com/api/webhooks/x/y").mock(return_value=httpx.Response(400))

    with pytest.raises(httpx.HTTPStatusError):
        send(_listing(), _score())


@respx.mock
def test_send_truncates_over_limit_message(monkeypatch):
    monkeypatch.setattr("app.notifier.discord.settings.discord_webhook_url", "https://discord.com/api/webhooks/x/y")
    route = respx.post("https://discord.com/api/webhooks/x/y").mock(return_value=httpx.Response(204))

    listing = Listing(
        fb_listing_id="1", url="https://example.com/listing/1", title="Long car", price_amount=100.0, raw_apify_data={}
    )
    score = Score(
        match_score=85, summary="x" * 3000, pros=[], cons=[], dealbreaker_flags=[], model_used="claude-haiku-4-5"
    )

    send(listing, score)

    import json

    payload = json.loads(route.calls.last.request.content)
    assert len(payload["content"]) <= 2000
    assert payload["content"].endswith("https://example.com/listing/1")


def test_send_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr("app.notifier.discord.settings.discord_webhook_url", None)

    with pytest.raises(RuntimeError, match="DISCORD_WEBHOOK_URL"):
        send(_listing(), _score())
