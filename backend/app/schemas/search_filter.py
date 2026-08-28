from pydantic import BaseModel, ConfigDict, model_validator


class SearchFilterIn(BaseModel):
    name: str
    is_active: bool = True

    # "url": search_url is required, used as-is.
    # "location": location is required; query/min_price/max_price/radius_miles/
    # days_listed/condition are optional refinements — see app/scraper/url_builder.py.
    search_mode: str = "url"
    search_url: str | None = None

    location: str | None = None
    query: str | None = None
    min_price: int | None = None
    max_price: int | None = None
    radius_miles: int | None = None
    days_listed: int | None = None
    condition: str | None = None
    results_limit: int = 100
    criteria_profile_id: int | None = None

    # ScrapeCreators-only — ignored by other providers. See
    # app/scraper/scrape_creators_backend.py for the accepted enum values.
    sort_by: str | None = None
    delivery_method: str | None = None
    availability: str | None = None

    # Geocode cache — see the SearchFilter model. Normally resolved lazily from
    # `location` on first run, but the admin UI also lets ScrapeCreators users
    # set these directly (e.g. via a "use my location" button), which is why
    # `location` is only required when both of these are absent.
    latitude: float | None = None
    longitude: float | None = None

    @model_validator(mode="after")
    def _check_mode_requirements(self):
        if self.search_mode not in ("url", "location"):
            raise ValueError(f"search_mode must be 'url' or 'location', got {self.search_mode!r}")
        if self.search_mode == "url" and not self.search_url:
            raise ValueError("search_url is required when search_mode is 'url'")
        if self.search_mode == "location" and not self.location and (self.latitude is None or self.longitude is None):
            raise ValueError("location is required when search_mode is 'location', unless latitude and longitude are both set")
        return self


class SearchFilterOut(SearchFilterIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
