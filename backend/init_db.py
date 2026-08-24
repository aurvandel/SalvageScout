#!/usr/bin/env python3
"""Initialize the SQLite database with all tables."""

from app.db import engine, Base
from app.models import Listing, Score, CriteriaProfile, SearchFilter  # noqa: F401

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("✅ Database initialized successfully!")
