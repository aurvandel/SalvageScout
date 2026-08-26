"""Approximate USD price per 1M tokens (input, output) for each supported model.

No provider exposes an API to look this up, so these are hand-maintained from
published pricing pages as of 2026-08-26. Spend estimates computed from this
table will drift if a provider changes prices — revisit when adding a model.
"""

PRICING_PER_MILLION_TOKENS: dict[str, tuple[float, float]] = {
    "anthropic/claude-haiku-4-5": (1.00, 5.00),
    "anthropic/claude-sonnet-4": (3.00, 15.00),
    "anthropic/claude-opus-4-1": (15.00, 75.00),
    "openai/gpt-4-turbo": (10.00, 30.00),
    "openai/gpt-4o": (2.50, 10.00),
    "openai/gpt-4o-mini": (0.15, 0.60),
    "gemini/gemini-2.0-flash": (0.10, 0.40),
    "gemini/gemini-1.5-flash": (0.075, 0.30),
    "gemini/gemini-1.5-pro": (1.25, 5.00),
}


def estimate_cost_usd(model_used: str, input_tokens: int, output_tokens: int) -> float | None:
    """model_used is the "{provider}/{model}" key stored on Score rows.
    Returns None if the model isn't in the pricing table (no estimate possible)."""
    pricing = PRICING_PER_MILLION_TOKENS.get(model_used)
    if pricing is None:
        return None
    input_price, output_price = pricing
    return (input_tokens / 1_000_000) * input_price + (output_tokens / 1_000_000) * output_price
