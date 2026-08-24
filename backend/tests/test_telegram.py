import httpx
import pytest
import respx

from app.models import AppSettings, Listing, Score
from app.notifier.telegram import send


def _listing():
    return Listing(fb_listing_id="1", url="https://example.com/1", title="2014 Impala", price_amount=2500.0, raw_apify_data={})


def _score():
    return Score(match_score=85, summary="Good deal.", pros=[], cons=[], dealbreaker_flags=[], model_used="claude-haiku-4-5")


def _config(bot_token, chat_id):
    return AppSettings(telegram_bot_token=bot_token, telegram_chat_id=chat_id)


@respx.mock
def test_send_posts_to_telegram_api():
    route = respx.post("https://api.telegram.org/bottest-token/sendMessage").mock(return_value=httpx.Response(200))

    send(_listing(), _score(), _config("test-token", "12345"))

    assert route.called
    payload = route.calls.last.request.content
    assert b"2014 Impala" in payload
    assert b"12345" in payload


@respx.mock
def test_send_raises_on_http_error():
    respx.post("https://api.telegram.org/bottest-token/sendMessage").mock(return_value=httpx.Response(400))

    with pytest.raises(httpx.HTTPStatusError):
        send(_listing(), _score(), _config("test-token", "12345"))


def test_send_raises_when_not_configured():
    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"):
        send(_listing(), _score(), _config(None, None))
