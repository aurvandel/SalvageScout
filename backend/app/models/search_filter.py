from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SearchFilter(Base):
    __tablename__ = "search_filters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

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
