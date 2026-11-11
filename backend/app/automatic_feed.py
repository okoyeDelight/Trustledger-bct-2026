"""Synthetic blood-bank source connector and append-only feed.

No clinical authorization. Production requires migration 004 on a separate
approved database branch before deployment. SQLite is for local tests only.
"""
import csv
import hashlib
import json
import secrets
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from app import workflow_store

DATASET_FILES = {
    "donations": "donations.csv",
    "facilities": "facilities.csv",
    "power_outages": "power_outages.csv",
    "temperature_logs": "temperature_logs.csv",
    "transfers": "transfers.csv",
    "units": "units.csv",
}
DEMO_SOURCE = "organizer-synthetic-demo"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _hash(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _sqlite_tables(conn):
    conn.executescript("""
      CREATE TABLE IF NOT EXISTS tl_demo_keys (
        key_id TEXT PRIMARY KEY, label TEXT NOT NULL,
        key_hash TEXT UNIQUE NOT NULL, key_hint TEXT NOT NULL,
        created_by TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tl_demo_key_revocations (
        key_id TEXT PRIMARY KEY, revoked_by TEXT NOT NULL, revoked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tl_demo_feed_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_code TEXT NOT NULL, source_event_id TEXT NOT NULL,
        dataset TEXT NOT NULL, facility_code TEXT,
        observed_at TEXT, payload TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
        incident_ref TEXT UNIQUE, incident_category TEXT,
        incident_severity TEXT, created_at TEXT NOT NULL,
        UNIQUE(source_code,source_event_id)
      );
      CREATE INDEX IF NOT EXISTS tl_demo_events_time_idx ON tl_demo_feed_events(id DESC);
      CREATE TRIGGER IF NOT EXISTS feed_event_no_update BEFORE UPDATE ON tl_demo_feed_events
        BEGIN SELECT RAISE(ABORT, 'feed events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS feed_event_no_delete BEFORE DELETE ON tl_demo_feed_events
        BEGIN SELECT RAISE(ABORT, 'feed events are append-only'); END;
    """)


@contextmanager
def _cursor(sqlite_factory, *, write=False):
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                yield cur, True
    else:
        with closing(sqlite_factory()) as conn:
            _sqlite_tables(conn)
            if write:
                conn.execute("BEGIN IMMEDIATE")
            try:
                yield conn, False
                if write:
                    conn.commit()
            except Exception:
                if write:
                    conn.rollback()
                raise


def _rows(cur, pg):
    return [dict(row) for row in cur.fetchall()]


def generate_key(label, actor_username, sqlite_factory):
    label = label.strip()
    if not 3 <= len(label) <= 80:
        raise HTTPException(422, "Connector label must be 3 to 80 characters.")
    raw = "tlb_" + secrets.token_urlsafe(32)
    record = (str(uuid4()), label, _hash(raw), raw[:8] + "…",
              actor_username, _now())
    with _cursor(sqlite_factory, write=True) as (cur, pg):
        if pg:
            cur.execute("""INSERT INTO tl_connector_keys
              (key_id,label,key_hash,key_hint,created_by,created_at)
              VALUES (%s,%s,%s,%s,%s,%s)""", record)
        else:
            cur.execute("""INSERT INTO tl_demo_keys
              (key_id,label,key_hash,key_hint,created_by,created_at)
              VALUES (?,?,?,?,?,?)""", record)
    return {"key_id": record[0], "label": label, "key": raw,
            "key_hint": record[3], "notice": "Shown once. Store only in the source system's private server settings."}


def list_keys(sqlite_factory):
    with _cursor(sqlite_factory) as (cur, pg):
        if pg:
            cur.execute("""SELECT k.key_id,k.label,k.key_hint,k.created_by,k.created_at,
               (r.key_id IS NOT NULL) AS revoked
               FROM tl_connector_keys k LEFT JOIN tl_connector_key_revocations r
               ON k.key_id=r.key_id ORDER BY k.created_at DESC""")
        else:
            cur.execute("""SELECT k.key_id,k.label,k.key_hint,k.created_by,k.created_at,
               (r.key_id IS NOT NULL) AS revoked
               FROM tl_demo_keys k LEFT JOIN tl_demo_key_revocations r
               ON k.key_id=r.key_id ORDER BY k.created_at DESC""")
        return _rows(cur, pg)


def revoke_key(key_id, actor_username, sqlite_factory):
    with _cursor(sqlite_factory, write=True) as (cur, pg):
        cur.execute(
            "SELECT key_id FROM tl_connector_keys WHERE key_id=%s" if pg
            else "SELECT key_id FROM tl_demo_keys WHERE key_id=?", (key_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Connector key not found.")
        if pg:
            cur.execute("""INSERT INTO tl_connector_key_revocations(key_id,revoked_by,revoked_at)
                VALUES (%s,%s,%s) ON CONFLICT (key_id) DO NOTHING""",
                (key_id,actor_username,_now()))
        else:
            cur.execute("""INSERT OR IGNORE INTO tl_demo_key_revocations
                (key_id,revoked_by,revoked_at) VALUES (?,?,?)""",
                (key_id,actor_username,_now()))
    return {"revoked": True}


def authenticate_key(bearer, sqlite_factory):
    if not bearer or not bearer.startswith("Bearer "):
        raise HTTPException(401, "Blood bank connector key required.")
    raw = bearer.removeprefix("Bearer ").strip()
    if not raw.startswith("tlb_") or len(raw) > 256:
        raise HTTPException(401, "Invalid connector key.")
    with _cursor(sqlite_factory) as (cur, pg):
        cur.execute(
            """SELECT k.key_id,k.label FROM tl_connector_keys k
               LEFT JOIN tl_connector_key_revocations r ON k.key_id=r.key_id
               WHERE k.key_hash=%s AND r.key_id IS NULL""" if pg else
            """SELECT k.key_id,k.label FROM tl_demo_keys k
               LEFT JOIN tl_demo_key_revocations r ON k.key_id=r.key_id
               WHERE k.key_hash=? AND r.key_id IS NULL""", (_hash(raw),))
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Invalid or revoked connector key.")
    return dict(row)


def _incident_details(dataset, record):
    facility = record.get("facility_id") or record.get("from_facility_id")
    observed = (record.get("recorded_at") or record.get("start_time")
                or record.get("dispatched_at") or record.get("collection_date"))
    category = None
    severity = None
    title = None
    temp = None
    if dataset == "temperature_logs":
        try:
            temp = float(record["temp_c"])
        except (ValueError, TypeError, KeyError):
            category, title = "sensor_anomaly", "Missing or invalid temperature reading"
        else:
            if temp in (-99.0, 99.9, 0.0):
                category, title = "sensor_anomaly", "Known sensor-error sentinel"
            elif temp < 2 or temp > 6:
                category, title = "temperature_excursion", "Out-of-range facility reading"
    elif dataset == "power_outages":
        backup = str(record.get("backup_power_engaged", "")).lower()
        if backup in ("false", "0", "no"):
            category, title = "equipment_problem", "Recorded power outage without backup"
    elif dataset == "transfers":
        try:
            temp = float(record["coolbox_max_temp_c"])
            if temp > 6:
                category, title = "temperature_excursion", "Transport temperature requires investigation"
        except (ValueError, TypeError, KeyError):
            pass
    if category:
        severity = "needs_review"
    return {
        "facility_code": str(facility) if facility else None,
        "observed_at": str(observed) if observed else None,
        "incident_category": category,
        "incident_severity": severity,
        "title": title,
        "temp": temp,
    }


def ingest(source_code, event_id, dataset, source_record, sqlite_factory, *,
           lock_demo=False):
    if dataset not in DATASET_FILES:
        raise HTTPException(422, "Unknown source dataset.")
    if not isinstance(source_record, dict):
        raise HTTPException(422, "source_record must be an object.")
    if len(source_code) > 80 or not source_code or len(event_id) > 160 or not event_id:
        raise HTTPException(422, "Invalid source or event identifier.")
    payload = _canonical(source_record)
    if len(payload) > 16000:
        raise HTTPException(413, "Source record exceeds 16 KB.")
    digest = _hash(payload)
    info = _incident_details(dataset, source_record)
    incident_ref = ("SRC-" + _hash(source_code + ":" + event_id)[:20].upper()
                    if info["incident_category"] else None)
    params = (source_code, event_id, dataset, info["facility_code"], info["observed_at"],
              payload, digest, incident_ref, info["incident_category"],
              info["incident_severity"], _now())
    with _cursor(sqlite_factory, write=True) as (cur, pg):
        if pg and lock_demo:
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))",
                        ("trustledger-demo-feed",))
        if pg:
            cur.execute("""INSERT INTO tl_source_feed_events
               (source_code,source_event_id,dataset,facility_code,observed_at,
               payload,payload_sha256,incident_ref,incident_category,incident_severity,created_at)
               VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s)
               ON CONFLICT (source_code,source_event_id) DO NOTHING
               RETURNING id""", params)
        else:
            cur.execute("""INSERT OR IGNORE INTO tl_demo_feed_events
               (source_code,source_event_id,dataset,facility_code,observed_at,
                payload,payload_sha256,incident_ref,incident_category,incident_severity,created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""", params)
        inserted = bool(cur.fetchone()) if pg else bool(cur.rowcount)
        cur.execute(
            """SELECT payload_sha256,incident_ref FROM tl_source_feed_events
               WHERE source_code=%s AND source_event_id=%s""" if pg else
            """SELECT payload_sha256,incident_ref FROM tl_demo_feed_events
               WHERE source_code=? AND source_event_id=?""",
            (source_code,event_id))
        saved = dict(cur.fetchone())
        if saved["payload_sha256"] != digest:
            raise HTTPException(409, "Event ID reused with different source content.")
    return {"recorded": inserted, "duplicate": not inserted,
            "incident_ref": saved["incident_ref"], "source_event_id": event_id}


def feed_events(sqlite_factory, *, limit=40):
    with _cursor(sqlite_factory) as (cur, pg):
        cur.execute(
            """SELECT source_code,source_event_id,dataset,facility_code,observed_at,
                      incident_ref,incident_category,created_at
               FROM tl_source_feed_events ORDER BY id DESC LIMIT %s""" if pg else
            """SELECT source_code,source_event_id,dataset,facility_code,observed_at,
                      incident_ref,incident_category,created_at
               FROM tl_demo_feed_events ORDER BY id DESC LIMIT ?""", (limit,))
        return _rows(cur, pg)


def source_incidents(sqlite_factory, *, incident_ref=None):
    with _cursor(sqlite_factory) as (cur, pg):
        query = """SELECT source_code,source_event_id,dataset,facility_code,observed_at,
                 payload,incident_ref,incident_category,incident_severity,created_at
                 FROM """ + ("tl_source_feed_events" if pg else "tl_demo_feed_events") + """
                 WHERE incident_ref IS NOT NULL"""
        params = ()
        if incident_ref:
            query += " AND incident_ref=" + ("%s" if pg else "?")
            params = (incident_ref,)
        query += " ORDER BY id DESC LIMIT 1000"
        cur.execute(query, params)
        records = _rows(cur, pg)
    items = []
    for r in records:
        raw = json.loads(r["payload"]) if isinstance(r["payload"], str) else r["payload"]
        detail = _incident_details(r["dataset"], raw)
        stamp = r["observed_at"] or r["created_at"]
        items.append({
            "incident_id": r["incident_ref"],
            "facility_id": r["facility_code"] or "UNKNOWN",
            "start_time": str(stamp),
            "end_time": str(stamp),
            "duration_hours": None,
            "reading_count": 1,
            "peak_temp_c": detail["temp"] if r["dataset"] == "temperature_logs" else None,
            "minimum_temp_c": detail["temp"] if r["dataset"] == "temperature_logs" else None,
            "direction": r["incident_category"],
            "severity": "needs_review",
            "sustained_rule": "Single observed source flag; requires investigation, not clinical disposition.",
            "report_title": detail["title"],
            "report_description": "Imported from " + r["dataset"] + " / " + r["source_event_id"],
            "source_type": "source_feed",
            "source_record": raw,
        })
    return items


def catalog(raw_dir):
    out = []
    for name, filename in DATASET_FILES.items():
        path = Path(raw_dir) / filename
        out.append({"dataset": name, "filename": filename, "available": path.is_file()})
    return out


def demo_sequence(raw_dir):
    """Deterministic small selection of actual rows from all six source CSVs.

    Only actual source records are replayed. This is not the full dataset streaming
    or real-time device integration. Skip missing files, never generate fake rows.
    """
    selections = {}
    for dataset, filename in DATASET_FILES.items():
        path = Path(raw_dir) / filename
        rows = []
        if path.exists():
            with path.open(newline="", encoding="utf-8-sig") as handle:
                for index, row in enumerate(csv.DictReader(handle)):
                    interesting = (dataset == "temperature_logs" and
                                   _incident_details(dataset, row)["incident_category"]) or (
                                   dataset == "power_outages" and
                                   _incident_details(dataset, row)["incident_category"]) or (
                                   dataset == "transfers" and
                                   _incident_details(dataset, row)["incident_category"])
                    if len(rows) < 2 or interesting:
                        rows.append((index, row))
                    if len(rows) >= 5:
                        break
        selections[dataset] = rows
    # Interleave domains: one row per dataset, then another, rather than six batches.
    queue = []
    for rank in range(5):
        for dataset in DATASET_FILES:
            rows = selections[dataset]
            if rank < len(rows):
                index, record = rows[rank]
                queue.append({"source_code": DEMO_SOURCE,
                              "source_event_id": dataset + ":" + str(index),
                              "dataset": dataset, "source_record": record})
    return queue


def demo_next(raw_dir, sqlite_factory):
    """One atomic event per call, intended for a 60-second source-console timer.

    Never rely on an always-running Python worker in a serverless deployment.
    """
    queue = demo_sequence(raw_dir)
    if not queue:
        raise HTTPException(503, "The pinned synthetic source dataset is unavailable.")
    with _cursor(sqlite_factory, write=True) as (cur, pg):
        if pg:
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))",
                        ("trustledger-demo-feed",))
        cur.execute(
            "SELECT source_event_id FROM tl_source_feed_events WHERE source_code=%s" if pg
            else "SELECT source_event_id FROM tl_demo_feed_events WHERE source_code=?",
            (DEMO_SOURCE,))
        delivered = {row["source_event_id"] for row in _rows(cur, pg)}
        selected = next((e for e in queue if e["source_event_id"] not in delivered), None)
        if selected is None:
            return {"completed": True, "remaining": 0}
        # Call in the same transaction to prevent concurrent tabs selecting twice.
        info = _incident_details(selected["dataset"], selected["source_record"])
        payload = _canonical(selected["source_record"])
        ref = ("SRC-" + _hash(DEMO_SOURCE + ":" + selected["source_event_id"])[:20].upper()
               if info["incident_category"] else None)
        params = (DEMO_SOURCE, selected["source_event_id"], selected["dataset"],
                  info["facility_code"], info["observed_at"], payload, _hash(payload),
                  ref, info["incident_category"], info["incident_severity"], _now())
        if pg:
            cur.execute("""INSERT INTO tl_source_feed_events
              (source_code,source_event_id,dataset,facility_code,observed_at,payload,
               payload_sha256,incident_ref,incident_category,incident_severity,created_at)
               VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s)""", params)
        else:
            cur.execute("""INSERT INTO tl_demo_feed_events
              (source_code,source_event_id,dataset,facility_code,observed_at,payload,
               payload_sha256,incident_ref,incident_category,incident_severity,created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""", params)
        return {"completed": False, "remaining": len(queue)-len(delivered)-1,
                "event": {"source_event_id": selected["source_event_id"],
                          "dataset": selected["dataset"], "incident_ref": ref}}
