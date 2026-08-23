import json
import os
from pathlib import Path

import pytest

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://salvagescout:salvagescout@localhost:5432/salvagescout_test"
)

from app.db import Base, engine  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app import models  # noqa: E402,F401 — registers all model classes on Base.metadata

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    """A DB session whose changes are rolled back after each test, for isolation.
    ingest_listings() calls session.commit() internally; join_transaction_mode
    keeps that scoped to a SAVEPOINT so the outer transaction — and the final
    rollback — still contains everything the test does."""
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def raw_listings():
    return json.loads((FIXTURES_DIR / "sample_listings.json").read_text())


@pytest.fixture
def raw_listing(raw_listings):
    """The Ford Crown Victoria — a "normal" listing with no strikethrough price."""
    return next(item for item in raw_listings if item["id"] == "839387795495137")
