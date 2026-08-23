from app.notifier import discord, telegram
from app.notifier.base import Notifier

_NOTIFIERS: dict[str, Notifier] = {
    "discord": discord.send,
    "telegram": telegram.send,
}


def get_notifier(channel: str) -> Notifier:
    try:
        return _NOTIFIERS[channel]
    except KeyError:
        raise ValueError(f"Unknown notification channel {channel!r}. Available: {sorted(_NOTIFIERS)}") from None


def available_channels() -> list[str]:
    return sorted(_NOTIFIERS)
