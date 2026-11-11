"""Append-only, server-enforced case lifecycle for synthetic TrustLedger incidents.

A source flag is *not* clinical approval. A worker submits findings, a different
supervisor evaluates the investigation flag, then work is tracked to closure.
Postgres serializes each case using a transaction-scoped advisory lock.
SQLite is a local test fallback and is never used for hosted writes.
"""
import json
import sqlite3
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from app import workflow_store

REVIEW_KINDS = {"accept": "review_accepted", "change": "review_returned", "reject": "review_rejected"}


def _timestamp(value):
    return value.isoformat() if isinstance(value, datetime) else str(value)


def _ensure_local(connection):
    connection.executescript("""
      CREATE TABLE IF NOT EXISTS case_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_reference TEXT NOT NULL,
        event_kind TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS case_events_ref_idx ON case_events(case_reference,id);
      CREATE TRIGGER IF NOT EXISTS case_events_no_update BEFORE UPDATE ON case_events
        BEGIN SELECT RAISE(ABORT, 'case events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS case_events_no_delete BEFORE DELETE ON case_events
        BEGIN SELECT RAISE(ABORT, 'case events are append-only'); END;
    """)


@contextmanager
def _cursor(case_reference, sqlite_connection, write=False):
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                if write:
                    cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (case_reference,))
                yield cursor, True
    else:
        with closing(sqlite_connection()) as connection:
            _ensure_local(connection)
            workflow_store.ensure_local_workflow_tables(connection)
            if write:
                connection.execute("BEGIN IMMEDIATE")
            try:
                yield connection, False
                if write:
                    connection.commit()
            except Exception:
                if write:
                    connection.rollback()
                raise


def _load(cursor, postgres, case_reference):
    if postgres:
        result = cursor.execute(
            """SELECT id,case_reference,event_kind,actor_username,actor_name,
                      actor_role,details,created_at
               FROM tl_case_events WHERE case_reference=%s ORDER BY id""",
            (case_reference,),
        )
    else:
        result = cursor.execute(
            """SELECT id,case_reference,event_kind,actor_username,actor_name,
                      actor_role,details,created_at
               FROM case_events WHERE case_reference=? ORDER BY id""",
            (case_reference,),
        )
    out = []
    for row in result.fetchall():
        event = dict(row)
        if isinstance(event["details"], str):
            event["details"] = json.loads(event["details"])
        event["created_at"] = _timestamp(event["created_at"])
        out.append(event)
    return out


def _state(case_reference, events):
    status = "investigating"
    submitted_by = None
    followups = {}
    for event in events:
        kind = event["event_kind"]
        details = event["details"]
        if kind == "investigation_submitted":
            status = "awaiting_review"
            submitted_by = event["actor_username"]
        elif kind == "review_returned":
            status = "returned"
        elif kind in ("review_accepted", "review_rejected"):
            status = "followup"
        elif kind == "followup_created":
            action = {
                "action_id": details["action_id"],
                "description": details["description"],
                "owner_username": details["owner_username"],
                "due_at": details.get("due_at"),
                "status": "open",
                "created_at": event["created_at"],
                "completed_at": None,
                "completion_note": None,
            }
            followups[action["action_id"]] = action
        elif kind == "followup_completed":
            key = details["action_id"]
            if key in followups:
                followups[key]["status"] = "done"
                followups[key]["completed_at"] = event["created_at"]
                followups[key]["completion_note"] = details["completion_note"]
        elif kind == "case_closed":
            status = "closed"
        elif kind == "case_reopened":
            status = "investigating"
    return {
        "case_reference": case_reference,
        "status": status,
        "submitted_by": submitted_by,
        "followups": list(followups.values()),
        "events": events,
    }


def _append(cursor, postgres, case_reference, kind, user, details):
    stamp = datetime.now(timezone.utc).isoformat()
    data = json.dumps(details, sort_keys=True)
    if postgres:
        cursor.execute(
            """INSERT INTO tl_case_events(case_reference,event_kind,actor_username,
                       actor_name,actor_role,details,created_at)
               VALUES(%s,%s,%s,%s,%s,%s::jsonb,%s)""",
            (case_reference, kind, user.username, user.actor_name, user.role, data, stamp),
        )
    else:
        cursor.execute(
            """INSERT INTO case_events(case_reference,event_kind,actor_username,
                       actor_name,actor_role,details,created_at)
               VALUES(?,?,?,?,?,?,?)""",
            (case_reference, kind, user.username, user.actor_name, user.role, data, stamp),
        )


def get_case(case_reference, sqlite_connection):
    with _cursor(case_reference, sqlite_connection) as (cursor, postgres):
        return _state(case_reference, _load(cursor, postgres, case_reference))


def awaiting_review(sqlite_connection):
    """Only cases with a submitted investigation and no subsequent decision."""
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """SELECT DISTINCT ON (case_reference) case_reference,event_kind,
                       actor_username,created_at FROM tl_case_events
                       ORDER BY case_reference,id DESC"""
                )
                rows = cursor.fetchall()
    else:
        with closing(sqlite_connection()) as connection:
            _ensure_local(connection)
            rows = connection.execute(
                """SELECT e.* FROM case_events e JOIN (
                    SELECT case_reference,MAX(id) AS max_id FROM case_events
                    GROUP BY case_reference
                ) latest ON e.id=latest.max_id"""
            ).fetchall()
    return [
        {"case_reference": row["case_reference"],
         "submitted_by": row["actor_username"],
         "submitted_at": _timestamp(row["created_at"])}
        for row in rows if row["event_kind"] == "investigation_submitted"
    ]


def submit(case_reference, user, summary, sqlite_connection):
    if user.role != "facility_staff":
        raise HTTPException(403, "Only facility staff may submit an investigation.")
    with _cursor(case_reference, sqlite_connection, write=True) as (cursor, postgres):
        events = _load(cursor, postgres, case_reference)
        state = _state(case_reference, events)
        if state["status"] not in ("investigating", "returned"):
            raise HTTPException(409, "This incident is not accepting investigation submissions.")
        # Returned investigations require a fresh note responding to reviewer feedback.
        returns = [event["created_at"] for event in events if event["event_kind"] == "review_returned"]
        threshold = returns[-1] if returns else None
        if postgres:
            if threshold:
                result = cursor.execute(
                    """SELECT 1 FROM tl_investigation_notes WHERE case_reference=%s
                       AND actor_username=%s AND created_at>%s::timestamptz LIMIT 1""",
                    (case_reference, user.username, threshold),
                )
            else:
                result = cursor.execute(
                    """SELECT 1 FROM tl_investigation_notes WHERE case_reference=%s
                       AND actor_username=%s LIMIT 1""", (case_reference, user.username),
                )
        else:
            if threshold:
                result = cursor.execute(
                    """SELECT 1 FROM investigation_notes WHERE case_reference=?
                       AND actor_username=? AND created_at>? LIMIT 1""",
                    (case_reference, user.username, threshold),
                )
            else:
                result = cursor.execute(
                    """SELECT 1 FROM investigation_notes WHERE case_reference=?
                       AND actor_username=? LIMIT 1""", (case_reference, user.username),
                )
        if result.fetchone() is None:
            raise HTTPException(409, "Record a new investigation finding before submitting this case.")
        _append(cursor, postgres, case_reference, "investigation_submitted", user,
                {"summary": summary})
        events = _load(cursor, postgres, case_reference)
        return _state(case_reference, events)


def _saved_review(cursor, postgres, review_id):
    if postgres:
        result = cursor.execute(
            """SELECT review_id,incident_id,actor_username,actor_name,role,decision,
                reason,changed_assessment,created_at,auth_method
                FROM tl_review_events WHERE review_id=%s""", (review_id,),
        )
    else:
        result = cursor.execute("SELECT * FROM review_events WHERE review_id=?", (review_id,))
    row = result.fetchone()
    if row is None:
        return None
    return workflow_store._serialize_review(dict(row))


def review(case_reference, user, record, sqlite_connection):
    if user.role != "blood_service_supervisor":
        raise HTTPException(403, "Only a supervisor may sign an investigation review.")
    with _cursor(case_reference, sqlite_connection, write=True) as (cursor, postgres):
        # Replayed IDs are idempotent, including after state has changed.
        previous = _saved_review(cursor, postgres, record["review_id"])
        if previous:
            workflow_store._ensure_idempotent(previous, record)
            return previous, False
        state = _state(case_reference, _load(cursor, postgres, case_reference))
        if state["status"] != "awaiting_review":
            raise HTTPException(409, "The worker must submit an investigation before review.")
        if state["submitted_by"] == user.username:
            raise HTTPException(403, "An investigator cannot review their own submission.")
        if postgres:
            cursor.execute(
                """INSERT INTO tl_review_events
                  (review_id,incident_id,actor_username,actor_name,role,
                   decision,reason,changed_assessment,created_at,auth_method)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (record["review_id"], record["incident_id"], user.username,
                 record["actor_name"], record["role"], record["decision"],
                 record["reason"], record["changed_assessment"], record["created_at"],
                 record["auth_method"]),
            )
        else:
            cursor.execute(
                """INSERT INTO review_events
                  (review_id,incident_id,actor_name,role,decision,reason,
                   changed_assessment,created_at,auth_method)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (record["review_id"], record["incident_id"], record["actor_name"],
                 record["role"], record["decision"], record["reason"],
                 record["changed_assessment"], record["created_at"], record["auth_method"]),
            )
        _append(cursor, postgres, case_reference, REVIEW_KINDS[record["decision"]],
                user, {"review_id": record["review_id"], "reason": record["reason"],
                       "changed_assessment": record["changed_assessment"]})
        saved = _saved_review(cursor, postgres, record["review_id"])
        if not saved:
            raise HTTPException(503, "The review could not be confirmed.")
        return saved, True


def create_followup(case_reference, user, owner_username, description, due_at, sqlite_connection):
    if user.role != "blood_service_supervisor":
        raise HTTPException(403, "Only a supervisor can assign follow-up actions.")
    with _cursor(case_reference, sqlite_connection, write=True) as (cursor, postgres):
        state = _state(case_reference, _load(cursor, postgres, case_reference))
        if state["status"] != "followup":
            raise HTTPException(409, "Follow-up requires a completed supervisor review.")
        action_id = str(uuid4())
        _append(cursor, postgres, case_reference, "followup_created", user,
                {"action_id": action_id, "owner_username": owner_username,
                 "description": description, "due_at": due_at})
        return _state(case_reference, _load(cursor, postgres, case_reference))


def complete_followup(case_reference, action_id, user, completion_note, sqlite_connection):
    if user.role != "facility_staff":
        raise HTTPException(403, "Only assigned facility staff may complete follow-up.")
    with _cursor(case_reference, sqlite_connection, write=True) as (cursor, postgres):
        state = _state(case_reference, _load(cursor, postgres, case_reference))
        action = next((a for a in state["followups"] if a["action_id"] == action_id), None)
        if state["status"] != "followup" or not action or action["status"] != "open":
            raise HTTPException(409, "This follow-up is unavailable or already complete.")
        if action["owner_username"] != user.username:
            raise HTTPException(403, "This follow-up is assigned to a different worker.")
        _append(cursor, postgres, case_reference, "followup_completed", user,
                {"action_id": action_id, "completion_note": completion_note})
        return _state(case_reference, _load(cursor, postgres, case_reference))


def close(case_reference, user, reason, sqlite_connection):
    if user.role != "blood_service_supervisor":
        raise HTTPException(403, "Only the supervisor can close a case.")
    with _cursor(case_reference, sqlite_connection, write=True) as (cursor, postgres):
        state = _state(case_reference, _load(cursor, postgres, case_reference))
        if state["status"] != "followup":
            raise HTTPException(409, "A reviewed case is required before closing.")
        if any(a["status"] == "open" for a in state["followups"]):
            raise HTTPException(409, "All assigned follow-up actions must be completed.")
        _append(cursor, postgres, case_reference, "case_closed", user,
                {"reason": reason, "scope": "administrative_only_not_clinical_clearance"})
        return _state(case_reference, _load(cursor, postgres, case_reference))
