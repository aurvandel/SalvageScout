from typing import Protocol

from app.models import AppSettings, Listing, Score


class Notifier(Protocol):
    """One function per channel, same signature — see app/scorer/base.py for the
    identical pattern on the LLM side. Raises on failure; the caller (service.py)
    decides how that's logged, so a bad channel never blocks the others."""

    def __call__(self, listing: Listing, score: Score, config: AppSettings) -> None: ...


def compose_message(listing: Listing, score: Score) -> str:
    vehicle = " ".join(str(v) for v in (listing.year, listing.make, listing.model) if v) or listing.title
    price = f"${listing.price_amount:,.0f}" if listing.price_amount is not None else "price unknown"

    lines = [f"\U0001f697 {vehicle} — {price}", f"Match score: {score.match_score}/100", "", score.summary]

    if score.pros:
        lines += ["", "Pros:"] + [f"- {p}" for p in score.pros]
    if score.cons:
        lines += ["", "Cons:"] + [f"- {c}" for c in score.cons]
    if score.dealbreaker_flags:
        lines += ["", "⚠️ Dealbreakers:"] + [f"- {d}" for d in score.dealbreaker_flags]

    lines += ["", listing.url]
    return "\n".join(lines)


def truncate_for_limit(text: str, url: str, max_length: int) -> str:
    """Trim `text` to fit a channel's message-length limit, always keeping `url`
    intact at the end — a truncated body is fine, a broken link isn't."""
    if len(text) <= max_length:
        return text
    suffix = f"\n\n{url}"
    ellipsis = "…"
    body_budget = max_length - len(suffix) - len(ellipsis)
    return text[:body_budget].rstrip() + ellipsis + suffix
