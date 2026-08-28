from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.criteria_profile import CriteriaProfile


class SearchFilter(Base):
    __tablename__ = "search_filters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Which prompt scores this search's listings. Falls back to the globally
    # active CriteriaProfile (see pipeline.resolve_criteria_profile) when unset,
    # so existing filters keep working without configuration.
    criteria_profile_id: Mapped[int | None] = mapped_column(ForeignKey("criteria_profiles.id"), nullable=True)
    criteria_profile: Mapped["CriteriaProfile | None"] = relationship()

    # "url": search_url is used as-is. "location": search_url is built from the
    # structured fields below at scrape time — see app/scraper/url_builder.py.
    search_mode: Mapped[str] = mapped_column(String, nullable=False, default="url")
    search_url: Mapped[str | None] = mapped_column(String, nullable=True)

    location: Mapped[str | None] = mapped_column(String, nullable=True)
    query: Mapped[str | None] = mapped_column(String, nullable=True)
    min_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    radius_miles: Mapped[int | None] = mapped_column(Integer, nullable=True)
    days_listed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    condition: Mapped[str | None] = mapped_column(String, nullable=True)
    results_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    # ScrapeCreators-only refinements — its marketplace search endpoint accepts
    # these fixed enums, but Apify's URL-based search has no equivalent, so
    # they're simply left unset when that provider is active.
    sort_by: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_method: Mapped[str | None] = mapped_column(String, nullable=True)
    availability: Mapped[str | None] = mapped_column(String, nullable=True)

    # Geocode cache for scraper backends (e.g. ScrapeCreators) whose discovery
    # endpoint needs lat/lng rather than a location string — resolved once from
    # `location` and reused across runs instead of spending an API call every time.
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
