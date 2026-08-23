import httpx
import pytest
import respx

from app.models import Listing, Score
from app.notifier.telegram import send


def _listing():
    return Listing(fb_listing_id="1", url="https://example.com/1", title="2014 Impala", price_amount=2500.0, raw_apify_data={})


def _score():
    return Score(match_score=85, summary="Good deal.", pros=[], cons=[], dealbreaker_flags=[], model_used="claude-haiku-4-5")


@respx.mock
def test_send_posts_to_telegram_api(monkeypatch):
    monkeypatch.setattr("app.notifier.telegram.settings.telegram_bot_token", "test-token")
    monkeypatch.setattr("app.notifier.telegram.settings.telegram_chat_id", "12345")
    route = respx.post("https://api.telegram.org/bottest-token/sendMessage").mock(return_value=httpx.Response(200))

    send(_listing(), _score())

    assert route.called
    payload = route.calls.last.request.content
    assert b"2014 Impala" in payload
    assert b"12345" in payload


@respx.mock
def test_send_raises_on_http_error(monkeypatch):
    monkeypatch.setattr("app.notifier.telegram.settings.telegram_bot_token", "test-token")
    monkeypatch.setattr("app.notifier.telegram.settings.telegram_chat_id", "12345")
    respx.post("https://api.telegram.org/bottest-token/sendMessage").mock(return_value=httpx.Response(400))

    with pytest.raises(httpx.HTTPStatusError):
        send(_listing(), _score())


def test_send_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr("app.notifier.telegram.settings.telegram_bot_token", None)
    monkeypatch.setattr("app.notifier.telegram.settings.telegram_chat_id", None)

    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"):
        send(_listing(), _score())
