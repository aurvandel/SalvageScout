from urllib.parse import urlencode

from app.models import SearchFilter


def build_search_url(search_filter: SearchFilter) -> str:
    """Resolve the effective Apify `startUrls` entry for a filter. URL mode uses
    `search_url` verbatim; location mode composes it from structured fields, per
    the plan's confirmed finding that FB's own URL query params (price range,
    radius, days-listed, condition) work when appended to a real Marketplace
    search URL. Param names below are FB's documented UI query params — worth a
    spot-check against a live pull the first time a given param is used, same as
    the plan flagged for the actor itself."""
    if search_filter.search_mode == "location":
        if not search_filter.location:
            raise ValueError(f"Search filter {search_filter.id!r} is in location mode but has no location set")

        params: dict[str, str | int] = {}
        if search_filter.query:
            params["query"] = search_filter.query
        if search_filter.min_price is not None:
            params["minPrice"] = search_filter.min_price
        if search_filter.max_price is not None:
            params["maxPrice"] = search_filter.max_price
        if search_filter.radius_miles is not None:
            params["radius"] = search_filter.radius_miles
        if search_filter.days_listed is not None:
            params["daysSinceListed"] = search_filter.days_listed
        if search_filter.condition:
            params["itemCondition"] = search_filter.condition

        base = f"https://www.facebook.com/marketplace/{search_filter.location}/search/"
        query_string = urlencode(params)
        return f"{base}?{query_string}" if query_string else base

    if not search_filter.search_url:
        raise ValueError(f"Search filter {search_filter.id!r} is in URL mode but has no search_url set")
    return search_filter.search_url
