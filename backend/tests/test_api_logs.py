from sqlalchemy import func

from app.models import LogEntry


def _seed_log(db, message, level="INFO", logger_name="app.pipeline"):
    entry = LogEntry(level=level, logger_name=logger_name, message=message)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def _max_id(db) -> int:
    """Baseline for since_id assertions — log_entries is written outside the
    test transaction (its own SessionLocal, see app/log_capture.py), so other
    tests' committed rows may already be present. Scoping to since_id=<current
    max> isolates a test to only the rows it seeds itself."""
    return db.query(func.max(LogEntry.id)).scalar() or 0


def test_get_logs_since_id_with_no_new_entries_returns_empty(client, db):
    baseline = _max_id(db)

    response = client.get(f"/api/admin/logs?since_id={baseline}")

    assert response.status_code == 200
    assert response.json() == {"logs": [], "last_id": baseline}


def test_get_logs_since_id_returns_only_newer_entries_in_order(client, db):
    baseline = _max_id(db)
    first = _seed_log(db, "starting pipeline run")
    second = _seed_log(db, "scored listing 1")

    response = client.get(f"/api/admin/logs?since_id={baseline}")

    assert response.status_code == 200
    body = response.json()
    assert [row["message"] for row in body["logs"]] == ["starting pipeline run", "scored listing 1"]
    assert body["last_id"] == second.id
    assert body["logs"][0]["id"] == first.id
    assert body["logs"][0]["level"] == "INFO"
    assert body["logs"][0]["logger_name"] == "app.pipeline"


def test_get_logs_since_id_with_no_entries_after_it_keeps_last_id_unchanged(client, db):
    entry = _seed_log(db, "only entry")

    response = client.get(f"/api/admin/logs?since_id={entry.id}")

    assert response.json() == {"logs": [], "last_id": entry.id}


def test_get_logs_no_since_id_returns_most_recent_entries_in_chronological_order(client, db):
    """Seeded messages are the newest rows (monotonic ids), so a request for
    the N most recent entries must return exactly them, in ascending order —
    regardless of whatever else already exists in the table."""
    messages = [f"tail entry {i}" for i in range(3)]
    for message in messages:
        _seed_log(db, message)

    response = client.get("/api/admin/logs?limit=3")

    body = response.json()
    assert [row["message"] for row in body["logs"]] == messages
    assert body["last_id"] == _max_id(db)
