import json
import logging
from typing import Any
from urllib.parse import parse_qs, urlparse

import anthropic
import google.generativeai as genai
import openai

from app.models import SearchFilter
from app.settings_service import get_app_settings
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def resolve_query(search_filter: SearchFilter) -> str | None:
    """Extract search query from SearchFilter. In location mode, use search_filter.query
    directly. In URL mode, parse the 'query' parameter from the URL."""
    if search_filter.search_mode == "location" and search_filter.query:
        return search_filter.query

    if search_filter.search_mode == "url" and search_filter.search_url:
        parsed_url = urlparse(search_filter.search_url)
        query_params = parse_qs(parsed_url.query)
        query_list = query_params.get("query")
        if query_list:
            return query_list[0].strip()

    return None


def _batch_filter_with_llm(
    titles: list[str],
    query: str,
    provider: str,
    model: str,
    api_key: str,
) -> list[bool]:
    """Use LLM to filter titles against query. Returns list of bools (True = keep).
    On any error, fails open (returns True for all to preserve results)."""
    if not titles:
        return []

    prompt = f"""You are filtering search results. Given a search query, determine if each listing title is relevant.
Search query: "{query}"

For each title, respond with a JSON object indicating if it matches the query intent.
IMPORTANT: Only reject if the listing is clearly NOT what the user is searching for.
If uncertain, KEEP the result.

Titles to filter:
{json.dumps([(i, title) for i, title in enumerate(titles)])}

Respond with a JSON array of objects: [{{"index": 0, "keep": true}}, {{"index": 1, "keep": false}}, ...]
Only include the index and keep fields. Keep all indices 0 to {len(titles)-1}."""

    try:
        if provider == "anthropic":
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text
        elif provider == "openai":
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.choices[0].message.content
        elif provider == "gemini":
            genai.configure(api_key=api_key)
            model_obj = genai.GenerativeModel(model)
            response = model_obj.generate_content(prompt)
            text = response.text
        else:
            logger.warning(f"Unknown LLM provider: {provider}, keeping all results")
            return [True] * len(titles)

        # Parse the JSON response
        # Extract JSON array from the response (may contain extra text)
        json_start = text.find("[")
        json_end = text.rfind("]") + 1
        if json_start == -1 or json_end == 0:
            logger.warning("No JSON array in LLM response, keeping all results")
            return [True] * len(titles)

        json_text = text[json_start:json_end]
        verdicts = json.loads(json_text)

        # Validate response: check we got all indices and build result array
        if not isinstance(verdicts, list):
            logger.warning("LLM response is not a JSON array, keeping all results")
            return [True] * len(titles)

        result = [True] * len(titles)  # Default to keeping everything
        for verdict in verdicts:
            if isinstance(verdict, dict) and "index" in verdict and "keep" in verdict:
                idx = verdict["index"]
                if 0 <= idx < len(titles):
                    result[idx] = verdict["keep"]

        return result

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        logger.warning(f"Error parsing LLM response: {e}, keeping all results")
        return [True] * len(titles)
    except Exception as e:
        logger.warning(f"LLM filter error: {e}, keeping all results (fail open)")
        return [True] * len(titles)


def filter_listings_by_query(
    db: Session, items: list[dict[str, Any]], search_filter: SearchFilter
) -> list[dict[str, Any]]:
    """Filter already-normalized listings (see app/scraper/base.py) to match the
    search query using an LLM. Returns filtered list of items. If no query or
    LLM error, returns all items."""
    query = resolve_query(search_filter)
    if not query:
        return items

    titles = [
        (item.get("title") or "").strip()
        for item in items
    ]

    if not titles or not any(titles):
        return items

    config = get_app_settings(db)
    api_key = None
    provider = config.llm_provider or "anthropic"
    model = config.llm_model

    if provider == "anthropic":
        from app.settings_service import get_api_key_for_provider
        api_key = get_api_key_for_provider(config, "anthropic")
        if not model:
            model = "claude-haiku-4-5"
    elif provider == "openai":
        from app.settings_service import get_api_key_for_provider
        api_key = get_api_key_for_provider(config, "openai")
        if not model:
            model = "gpt-4o-mini"
    elif provider == "gemini":
        from app.settings_service import get_api_key_for_provider
        api_key = get_api_key_for_provider(config, "gemini")
        if not model:
            model = "gemini-2.0-flash"
    else:
        logger.warning(f"Unknown LLM provider: {provider}, keeping all results")
        return items

    if not api_key:
        logger.warning(f"No API key for {provider}, keeping all results")
        return items

    # Get verdicts from LLM
    verdicts = _batch_filter_with_llm(titles, query, provider, model, api_key)

    # Apply verdicts to filter items
    filtered = [
        item for item, keep in zip(items, verdicts) if keep
    ]

    rejected_count = len(items) - len(filtered)
    if rejected_count > 0:
        logger.info(f"Query filter '{query}': rejected {rejected_count}/{len(items)} results")

    return filtered
