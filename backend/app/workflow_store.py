"""One persistence boundary for the consolidated synthetic incident workflow.

Hosted deployments require Neon/PostgreSQL. SQLite is a local-only test fallback.
The restricted API database role can SELECT and INSERT records but cannot UPDATE
or DELETE original reports, investigation notes or reviewer decisions.
"""
from contextlib import closing
from datetime import datetime, timezone
import os
from uuid import uuid4

from fastapi import HTTPException


def use_postgres() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


def verify_persistence_config() -> None:
    if not use_postgres() and (
        os.environ.get("VERCEL") == "1"
        or os.environ.get("VERCEL") == "true"
        or os.environ.get("TRUSTLEDGER_REQUIRE_DATABASE") == "true"
    ):
        raise HTTPException(
            status_code=503,
            detail="Shared incident storage is not configured. No review was recorded.",
        )


def _connection():
    from psycopg import connect
    return connect(os.environ["DATABASE_URL"])


def _serialize_review(row):
    result = dict(row)
    result["review_id"] = str(result["review_id"])
    result["created_at"] = (
        result["created_at"].isoformat()
        if isinstance(result["created_at"], datetime)
        else str(result["created_at"])
    )
    result.pop("actor_username", None)
    return result


def save_review(record: dict, sqlite_connection):
    verify_persistence_config()
    if not use_postgres():
        with closing(sqlite_connection()) as connection, connection:
            existing = connection.execute(
                "SELECT * FROM review_events WHERE review_id = ?",
                (record["review_id"],),
            ).fetchone()
            if existing:
                existing_dict = dict(existing)
                _ensure_idempotent(existing_dict, record)
                return existing_dict, False
            connection.execute(
                """INSERT INTO review_events
                    (review_id,incident_id,actor_name,role,decision,reason,changed_assessment,created_at,auth_method)
                    VALUES (:review_id,:incident_id,:actor_name,:role,:decision,:reason,:changed_assessment,:created_at,:auth_method)""",
                record,
            )
        return record, True

    from psycopg.rows import dict_row
    with _connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """INSERT INTO tl_review_events
                    (review_id,incident_id,actor_username,actor_name,role,decision,reason,changed_assessment,created_at,auth_method)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (review_id) DO NOTHING RETURNING review_id""",
                (record["review_id"], record["incident_id"], record["actor_username"],
                 record["actor_name"], record["role"], record["decision"], record["reason"],
                 record["changed_assessment"], record["created_at"], record["auth_method"]),
            )
            inserted = cursor.fetchone() is not None
            cursor.execute(
                """SELECT review_id,incident_id,actor_username,actor_name,role,decision,
                   reason,changed_assessment,created_at,auth_method
                   FROM tl_review_events WHERE review_id=%s""",
                (record["review_id"],),
            )
            existing = cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=503, detail="Review could not be verified.")
    result = _serialize_review(existing)
    _ensure_idempotent(result, record)
    return result, inserted


def _ensure_idempotent(existing: dict, submitted: dict):
    fields = ("review_id","incident_id","actor_name","role","decision","reason",
              "changed_assessment","auth_method")
    if any(str(existing.get(k)) != str(submitted.get(k)) for k in fields):
        raise HTTPException(status_code=409, detail="Review ID already used for another decision.")


def reviews(limit: int, offset: int, sqlite_connection):
    verify_persistence_config()
    if not use_postgres():
        with closing(sqlite_connection()) as connection:
            total = connection.execute("SELECT COUNT(*) FROM review_events").fetchone()[0]
            rows = connection.execute(
                "SELECT * FROM review_events ORDER BY created_at DESC,review_id DESC LIMIT ? OFFSET ?",
                (limit,offset),
            ).fetchall()
        return [dict(x) for x in rows], total

    from psycopg.rows import dict_row
    with _connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute("SELECT count(*) AS total FROM tl_review_events")
            total = cursor.fetchone()["total"]
            cursor.execute(
                """SELECT review_id,incident_id,actor_name,role,decision,reason,
                    changed_assessment,created_at,auth_method
                    FROM tl_review_events ORDER BY created_at DESC,review_id DESC LIMIT %s OFFSET %s""",
                (limit,offset),
            )
            rows = cursor.fetchall()
    return [_serialize_review(row) for row in rows], total


def ensure_local_workflow_tables(connection):
    connection.executescript(
        """CREATE TABLE IF NOT EXISTS staff_reports (
             report_id TEXT PRIMARY KEY, report_ref TEXT UNIQUE NOT NULL,
             facility_code TEXT NOT NULL, category TEXT NOT NULL,
             title TEXT NOT NULL, description TEXT NOT NULL,
             observed_at TEXT NOT NULL, reported_by TEXT NOT NULL,
             created_at TEXT NOT NULL
           );
           CREATE TABLE IF NOT EXISTS investigation_notes (
             note_id TEXT PRIMARY KEY,case_reference TEXT NOT NULL,
             actor_username TEXT NOT NULL,actor_name TEXT NOT NULL,
             actor_role TEXT NOT NULL,finding TEXT NOT NULL,created_at TEXT NOT NULL
           );
           CREATE TRIGGER IF NOT EXISTS staff_reports_no_update BEFORE UPDATE ON staff_reports
             BEGIN SELECT RAISE(ABORT,'append-only report'); END;
           CREATE TRIGGER IF NOT EXISTS staff_reports_no_delete BEFORE DELETE ON staff_reports
             BEGIN SELECT RAISE(ABORT,'append-only report'); END;
           CREATE TRIGGER IF NOT EXISTS notes_no_update BEFORE UPDATE ON investigation_notes
             BEGIN SELECT RAISE(ABORT,'append-only note'); END;
           CREATE TRIGGER IF NOT EXISTS notes_no_delete BEFORE DELETE ON investigation_notes
             BEGIN SELECT RAISE(ABORT,'append-only note'); END;"""
    )


def create_staff_report(payload: dict, actor_username: str, sqlite_connection):
    verify_persistence_config()
    now = datetime.now(timezone.utc).isoformat()
    identifier = str(uuid4())
    row = {
        "report_id": identifier,
        "report_ref": "REP-" + identifier,
        "facility_code": payload["facility_code"],
        "category": payload["category"],
        "title": payload["title"],
        "description": payload["description"],
        "observed_at": payload["observed_at"],
        "reported_by": actor_username,
        "created_at": now,
    }
    if not use_postgres():
        with closing(sqlite_connection()) as connection, connection:
            ensure_local_workflow_tables(connection)
            connection.execute(
                """INSERT INTO staff_reports(report_id,report_ref,facility_code,category,title,
                  description,observed_at,reported_by,created_at)
                  VALUES (:report_id,:report_ref,:facility_code,:category,:title,
                  :description,:observed_at,:reported_by,:created_at)""",
                row,
            )
    else:
        with _connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO tl_staff_reports
                        (report_id,report_ref,facility_code,category,title,description,
                         observed_at,reported_by,created_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (identifier,row["report_ref"],row["facility_code"],row["category"],
                     row["title"],row["description"],row["observed_at"],
                     actor_username,now),
                )
    return row


def list_staff_reports(sqlite_connection):
    verify_persistence_config()
    if not use_postgres():
        with closing(sqlite_connection()) as connection:
            ensure_local_workflow_tables(connection)
            rows = connection.execute(
                "SELECT * FROM staff_reports ORDER BY created_at DESC"
            ).fetchall()
        return [dict(x) for x in rows]
    from psycopg.rows import dict_row
    with _connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """SELECT report_id,report_ref,facility_code,category,title,description,
                   observed_at,reported_by,created_at
                   FROM tl_staff_reports ORDER BY created_at DESC LIMIT 1000"""
            )
            rows = cursor.fetchall()
    out = []
    for row in rows:
        entry=dict(row)
        for field in ("report_id","observed_at","created_at"):
            entry[field]=str(entry[field])
        out.append(entry)
    return out


def add_investigation_note(case_reference: str, finding: str, user, sqlite_connection):
    verify_persistence_config()
    now=datetime.now(timezone.utc).isoformat()
    note={
        "note_id":str(uuid4()),
        "case_reference":case_reference,
        "actor_username":user.username,
        "actor_name":user.actor_name,
        "actor_role":user.role,
        "finding":finding,
        "created_at":now,
    }
    if not use_postgres():
        with closing(sqlite_connection()) as connection, connection:
            ensure_local_workflow_tables(connection)
            connection.execute(
                """INSERT INTO investigation_notes
                   (note_id,case_reference,actor_username,actor_name,actor_role,finding,created_at)
                   VALUES (:note_id,:case_reference,:actor_username,:actor_name,:actor_role,:finding,:created_at)""",
                note,
            )
    else:
        with _connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO tl_investigation_notes
                       (note_id,case_reference,actor_username,actor_name,actor_role,finding,created_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                    tuple(note.values()),
                )
    return note


def list_investigation_notes(case_reference: str, sqlite_connection):
    verify_persistence_config()
    if not use_postgres():
        with closing(sqlite_connection()) as connection:
            ensure_local_workflow_tables(connection)
            rows=connection.execute(
                "SELECT * FROM investigation_notes WHERE case_reference=? ORDER BY created_at,note_id",
                (case_reference,),
            ).fetchall()
        return [dict(x) for x in rows]
    from psycopg.rows import dict_row
    with _connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """SELECT note_id,case_reference,actor_username,actor_name,actor_role,finding,created_at
                   FROM tl_investigation_notes WHERE case_reference=%s ORDER BY created_at,note_id""",
                (case_reference,),
            )
            rows=cursor.fetchall()
    return [{**dict(row),"note_id":str(row["note_id"]),"created_at":row["created_at"].isoformat()} for row in rows]
