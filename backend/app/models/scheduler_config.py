from sqlalchemy import Column, Integer, Boolean, DateTime
from datetime import datetime

from app.db import Base


class SchedulerConfig(Base):
    __tablename__ = "scheduler_config"

    id = Column(Integer, primary_key=True, default=1)
    is_enabled = Column(Boolean, default=True)
    run_hour = Column(Integer, default=6)
    run_minute = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return (
            f"<SchedulerConfig(id={self.id}, is_enabled={self.is_enabled}, "
            f"run_time={self.run_hour:02d}:{self.run_minute:02d})>"
        )
