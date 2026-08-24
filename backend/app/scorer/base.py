from typing import Protocol

from app.models import CriteriaProfile, Listing
from app.scorer.schemas import ScoreResult


class Scorer(Protocol):
    """One function per LLM provider — same signature, same output schema, so
    the provider is a config choice rather than a rewrite. See the plan's
    'LLM provider comparison spike' item for why this exists before OpenAI/
    Gemini implementations do."""

    def __call__(
        self, listing: Listing, criteria_profile: CriteriaProfile, model: str, api_key: str | None
    ) -> ScoreResult: ...


def build_listing_text(listing: Listing) -> str:
    """Shared prompt-input formatting so every provider scores the same rendering
    of a listing — keeps a future provider comparison apples-to-apples."""
    lines = [
        f"Title: {listing.title}",
        f"Year/Make/Model: {listing.year or '?'} {listing.make or '?'} {listing.model or '?'}",
        f"Mileage: {listing.mileage if listing.mileage is not None else 'unknown'}",
        f"Price: {listing.price_amount} {listing.currency or ''}".strip(),
    ]
    if listing.strikethrough_price_amount:
        lines.append(f"Originally listed at: {listing.strikethrough_price_amount} (marked down)")
    lines.append(f"Location: {listing.location_text or 'unknown'}")
    lines.append(f"Condition: {listing.condition or 'unknown'}")
    lines.append(f"Description: {listing.description or '(no description provided)'}")
    return "\n".join(lines)
