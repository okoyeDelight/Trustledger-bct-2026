"""Actual append-only observation ingestion for an ABBIS-like synthetic sandbox.

Works with PostgreSQL on deployed environments and SQLite only in local tests.
The *source system* is simulated; the validated store, continuous-threshold rule,
incident case storage and return status are real application behavior.

For an external institution, configure TRUSTLEDGER_CONNECTOR_API_KEY and add
institutional authentication, source/facility scope and reconciliation policy.
This MVP explicitly excludes live external access until those controls exist.
"""
from contextlib import closing
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException

from app import external_bridge, workflow_store

UPPER_C = 6.0
LOWER_C = 2.0


def _init_sqlite(connection):
    connection.executescript("""
    CREATE TABLE IF NOT EXISTS connector_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_system TEXT NOT NULL,
      source_event_id TEXT NOT NULL,
      facility_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      temperature_c REAL NOT NULL,
      payload TEXT NOT NULL,
      received_at TEXT NOT NULL,
      UNIQUE (source_system, source_event_id)
    );
    CREATE INDEX IF NOT EXISTS connector_obs_facility_time ON
      connector_observations(source_system, facility_id, observed_at, id);
    CREATE TRIGGER IF NOT EXISTS connector_obs_no_update BEFORE UPDATE ON connector_observations
      BEGIN SELECT RAISE(ABORT, 'connector observations are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS connector_obs_no_delete BEFORE DELETE ON connector_observations
      BEGIN SELECT RAISE(ABORT, 'connector observations are append-only'); END;
    """)


def _iso(value: Any) -> str:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise HTTPException(422, "Source event requires an explicit timezone.")
    return parsed.astimezone(timezone.utc).isoformat()


def _fetch(cursor, postgres, source_system, source_event_id):
    if postgres:
        cursor.execute(
            """SELECT source_system,source_event_id,facility_id,observed_at,
                      temperature_c,payload FROM tl_connector_observations
               WHERE source_system=%s AND source_event_id=%s""",
            (source_system, source_event_id),
        )
    else:
        cursor.execute(
            """SELECT source_system,source_event_id,facility_id,observed_at,
                      temperature_c,payload FROM connector_observations
               WHERE source_system=? AND source_event_id=?""",
            (source_system, source_event_id),
        )
    item = cursor.fetchone()
    if item is None:
        return None
    row = dict(item)
    if isinstance(row["payload"], str):
        import json
        row["payload"] = json.loads(row["payload"])
    row["observed_at"] = _iso(row["observed_at"])
    row["temperature_c"] = float(row["temperature_c"])
    return row


def _all_for_facility(cursor, postgres, source, facility):
    if postgres:
        cursor.execute(
            """SELECT source_event_id, observed_at, temperature_c FROM tl_connector_observations
               WHERE source_system=%s AND facility_id=%s ORDER BY observed_at, id LIMIT 2000""",
            (source, facility),
        )
    else:
        cursor.execute(
            """SELECT source_event_id, observed_at, temperature_c FROM connector_observations
               WHERE source_system=? AND facility_id=? ORDER BY observed_at, id LIMIT 2000""",
            (source, facility),
        )
    rows = []
    for item in cursor.fetchall():
        row = dict(item)
        rows.append({
            "source_event_id": row["source_event_id"],
            "observed_at": _iso(row["observed_at"]),
            "temperature_c": float(row["temperature_c"]),
        })
    return rows


def _select_episodes(records):
    """Four distinct hourly readings above 6°C; no bridging gaps or normals."""
    from datetime import timedelta
    ordered = sorted(records, key=lambda x: (x["observed_at"], x["source_event_id"]))
    seen_timestamps = set()
    current = []
    output = []
    for r in ordered:
        at = datetime.fromisoformat(r["observed_at"])
        if at in seen_timestamps:
            current = []
            continue
        seen_timestamps.add(at)
        above = r["temperature_c"] > UPPER_C
        if above:
            previous = datetime.fromisoformat(current[-1]["observed_at"]) if current else None
            if previous is None or at - previous != timedelta(hours=1):
                current = []
            current.append(r)
            if len(current) == 4:
                output.append(current[:])
        else:
            current = []
    return output


def ingest_observation(payload: dict, sqlite_connection):
    """Atomic observation insert; deterministic recompute; one case per initial four samples."""
    import json

    workflow_store.verify_persistence_config()
    temperature = float(payload["temperature_c"])
    if temperature in (-99.0, 99.9, 0.0) or not -50 < temperature < 80:
        raise HTTPException(422, "Invalid/sentinel temperature is not reliable observation evidence.")
    source, event_id, facility = (
        payload["source_system"], payload["source_event_id"], payload["facility_id"]
    )
    normalized = {
        **payload,
        "observed_at": _iso(payload["observed_at"]),
    }
    serialized = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    stored = False

    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("connector:" + source + ":" + facility,))
                cur.execute(
                    """INSERT INTO tl_connector_observations(source_system,source_event_id,
                         facility_id,observed_at,temperature_c,payload)
                       VALUES (%s,%s,%s,%s,%s,%s::jsonb)
                       ON CONFLICT (source_system,source_event_id) DO NOTHING
                       RETURNING source_event_id""",
                    (source, event_id, facility, normalized["observed_at"], temperature, serialized),
                )
                stored = cur.fetchone() is not None
                previous = _fetch(cur, True, source, event_id)
                readings = _all_for_facility(cur, True, source, facility)
    else:
        with closing(sqlite_connection()) as connection:
            _init_sqlite(connection)
            connection.execute("BEGIN IMMEDIATE")
            try:
                cur = connection.cursor()
                cur.execute(
                    """INSERT OR IGNORE INTO connector_observations(source_system,source_event_id,
                       facility_id,observed_at,temperature_c,payload,received_at)
                       VALUES (?,?,?,?,?,?,?)""",
                    (source, event_id, facility, normalized["observed_at"], temperature,
                     serialized, datetime.now(timezone.utc).isoformat()),
                )
                stored = cur.rowcount == 1
                previous = _fetch(cur, False, source, event_id)
                readings = _all_for_facility(cur, False, source, facility)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    if not previous or previous["payload"] != normalized:
        raise HTTPException(409, "Source event ID already represents different evidence. No overwrite allowed.")

    case_ref = None
    case_created = False
    for window in _select_episodes(readings):
        # Episode case key is derived from the FIRST qualifying sample, so reading #5
        # does not create a second incident. Original observations remain immutable.
        source_key = "SUSTAINED:" + window[0]["source_event_id"]
        event = {
            **normalized,
            "source_event_id": source_key,
            "observed_at": window[-1]["observed_at"],
            "temperature_c": max(x["temperature_c"] for x in window),
            "episode_start_at": window[0]["observed_at"],
            "episode_end_at": window[-1]["observed_at"],
            "episode_readings": window,
            "detection_rule": "4 consecutive hourly samples above 6°C (synthetic policy)",
        }
        saved, created = external_bridge.persist_incident(event, sqlite_connection)
        case_created = case_created or created
        if any(x["source_event_id"] == event_id for x in window):
            case_ref = saved["report_ref"]

    return {
        "status": "received" if stored else "duplicate_acknowledged",
        "accepted": True,
        "source_event_id": event_id,
        "observation_stored": stored,
        "case_reference": case_ref,
        "case_created": case_created,
        "rule": "Four consecutive above-6°C hourly readings; missing hours break the sequence.",
        "clinical_clearance": None,
    }
