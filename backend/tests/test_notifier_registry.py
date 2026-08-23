import pytest

from app.notifier import discord, telegram
from app.notifier.registry import available_channels, get_notifier


def test_get_notifier_returns_discord():
    assert get_notifier("discord") is discord.send


def test_get_notifier_returns_telegram():
    assert get_notifier("telegram") is telegram.send


def test_get_notifier_unknown_channel_raises():
    with pytest.raises(ValueError, match="slack"):
        get_notifier("slack")


def test_available_channels():
    assert available_channels() == ["discord", "telegram"]
