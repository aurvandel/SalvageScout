from typing import Any
from urllib.parse import parse_qs, urlparse

from app.models import SearchFilter
from app.scraper.parser import parse_year_make_model

# Vehicle types to exclude based on keywords in title/description
_EXCLUSION_KEYWORDS = {
    "bike",
    "bicycle",
    "motorcycle",
    "scooter",
    "moped",
    "boat",
    "canoe",
    "kayak",
    "jetski",
    "jet-ski",
    "jet ski",
    "atv",
    "all-terrain",
    "quad",
    "trailer",
    "camper",
    "rv",
    "motorhome",
    "mower",
    "tractor",
    "lawnmower",
}

# Vehicle categories that match each query type
_VEHICLE_CATEGORIES = {
    "car": {
        "car",
        "automobile",
        "sedan",
        "suv",
        "crossover",
        "truck",
        "pickup",
        "van",
        "minivan",
        "wagon",
        "hatchback",
        "coupe",
        "convertible",
        "sports car",
    },
    "truck": {"truck", "pickup"},
    "suv": {"suv", "crossover"},
    "sedan": {"sedan"},
    "van": {"van", "minivan"},
    "motorcycle": {"motorcycle", "bike", "scooter"},
    "boat": {"boat", "sailboat", "motorboat"},
}


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
            return query_list[0].lower().strip()

    return None


def _contains_exclusion_keyword(text: str) -> bool:
    """Check if text contains any exclusion keywords (bikes, boats, etc)."""
    text_lower = text.lower()
    for keyword in _EXCLUSION_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def _matches_query_category(title: str, query: str) -> bool:
    """Check if listing title semantically matches the query category.
    Returns True if the title appears to be the vehicle type the user is looking for."""
    title_lower = title.lower()
    query_lower = query.lower()

    # Get the category keywords for this query
    category = _VEHICLE_CATEGORIES.get(query_lower)
    if not category:
        # Unknown query type — don't filter (user specified unusual query)
        return True

    # Check if any category keyword appears in the title
    for keyword in category:
        if keyword in title_lower:
            return True

    # Fallback: if title parses as a vehicle (year + make), and query is "car",
    # allow it (e.g., "2003 Ford Crown Victoria" has no explicit category but is a car)
    year, make, model = parse_year_make_model(title)
    if year and make and query_lower == "car":
        return True

    return False


def matches_query(raw_item: dict[str, Any], search_filter: SearchFilter) -> bool:
    """Determine if a raw listing matches the search filter's query.
    If no query is specified, return True (pass everything through).
    Returns True if the listing should be kept."""
    query = resolve_query(search_filter)
    if not query:
        # No query specified — keep the listing
        return True

    title = (raw_item.get("listingTitle") or "").strip()
    if not title:
        return True

    # Reject if title contains exclusion keywords (bikes, boats, etc)
    if _contains_exclusion_keyword(title):
        return False

    # Accept if title matches the query's vehicle category
    return _matches_query_category(title, query)
