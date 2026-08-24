from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    fb_listing_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    search_filter_id: Mapped[int | None] = mapped_column(ForeignKey("search_filters.id"))

    url: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)

    price_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str | None] = mapped_column(String)
    strikethrough_price_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))

    condition: Mapped[str | None] = mapped_column(String)
    is_live: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_sold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    location_text: Mapped[str | None] = mapped_column(String)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    postal_code: Mapped[str | None] = mapped_column(String)

    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Parsed at ingest time by regex from title/subtitle — not by the LLM scorer.
    year: Mapped[int | None] = mapped_column(Integer)
    make: Mapped[str | None] = mapped_column(String)
    model: Mapped[str | None] = mapped_column(String)
    mileage: Mapped[int | None] = mapped_column(Integer)

    raw_apify_data: Mapped[dict] = mapped_column(JSONB, nullable=False)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # User-driven state, distinct from is_live/is_pending/is_sold (which describe
    # Marketplace-side state and get overwritten on every re-scrape). Not touched
    # by ingest_listings()'s upsert, so a soft-deleted/hidden listing stays that
    # way even after it's seen again in a future search.
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    images: Mapped[list["ListingImage"]] = relationship(back_populates="listing", cascade="all, delete-orphan")
    scores: Mapped[list["Score"]] = relationship(back_populates="listing", cascade="all, delete-orphan")
