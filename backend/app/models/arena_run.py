from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ArenaRun(Base):
    __tablename__ = "arena_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), nullable=False)
    criteria_profile_id: Mapped[int] = mapped_column(ForeignKey("criteria_profiles.id"), nullable=False)

    providers: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    models: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
