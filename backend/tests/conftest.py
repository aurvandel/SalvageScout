import json
import os
from pathlib import Path

import pytest

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://salvagescout:salvagescout@localhost:5432/salvagescout_test"
)

# setdefault() above is a no-op if DATABASE_URL is already set in the environment
# (e.g. docker-compose sets it to the real dev database for the backend service) —
# so without this check, running pytest inside that container would point the
# _create_schema fixture's teardown drop_all() at real data instead of a test DB.
_database_url = os.environ["DATABASE_URL"]
if not _database_url.rsplit("/", 1)[-1].startswith("salvagescout_test"):
    raise RuntimeError(
        f"Refusing to run tests: DATABASE_URL={_database_url!r} does not point at a "
        "salvagescout_test database. The test suite drops all tables on teardown — "
        "set DATABASE_URL to a database named 'salvagescout_test...' before running pytest."
    )

from app.db import Base, engine, get_db  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app import models  # noqa: E402,F401 — registers all model classes on Base.metadata
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

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
def client(db):
    """A TestClient whose requests run against the same rolled-back-per-test `db`
    session, so API tests see the same isolation as direct-DB tests."""
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def raw_listings():
    return json.loads((FIXTURES_DIR / "sample_listings.json").read_text())


@pytest.fixture
def raw_listing(raw_listings):
    """The Ford Crown Victoria — a "normal" listing with no strikethrough price."""
    return next(item for item in raw_listings if item["id"] == "839387795495137")
