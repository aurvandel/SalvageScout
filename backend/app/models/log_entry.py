from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LogEntry(Base):
    """Application log lines captured for the admin panel's live log viewer.

    Written by both the `backend` and `scheduler` processes (see
    app/log_capture.py) so scheduled pipeline runs — which happen in the
    scheduler container, not backend — are visible too."""

    __tablename__ = "log_entries"
    __table_args__ = (Index("ix_log_entries_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    level: Mapped[str] = mapped_column(String, nullable=False)
    logger_name: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
