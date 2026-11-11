"""Synthetic external observation to real investigation bridge using existing append-only reports.

This is a controlled DEMONSTRATION adapter initiated by a signed-in facility
operator. It is not a real ABBIS endpoint, a sensor interface, or a clinical
approval. Reuses the existing, restricted tl_staff_reports table without a
schema migration. Stable case IDs and payload equality enforce idempotency.
"""
from contextlib import closing
from datetime import datetime, timezone
import json
import sqlite3
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException

from app import workflow_store


def _identifier(payload: dict) -> tuple[str, str]:
    stable = uuid5(
        NAMESPACE_URL,
        "trustledger-demo-observation-v1/" + payload["source_system"] + "/" + payload["source_event_id"],
    )
    return str(stable), "EXT-" + str(stable)


def _canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def unpack(description: str) -> dict:
    result = json.loads(description)
    if result.get("schema_version") != "trustledger.observation.v1":
        raise HTTPException(status_code=503, detail="Stored source metadata has an unsupported schema.")
    return result


def lookup(case_reference: str, sqlite_connection):
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """SELECT report_id,report_ref,facility_code,category,title,description,
                       observed_at,reported_by,created_at
                       FROM tl_staff_reports WHERE report_ref=%s""",
                    (case_reference,),
                )
                row = cursor.fetchone()
        if not row:
            return None
        found = dict(row)
        return {
            **found,
            "report_id": str(found["report_id"]),
            "observed_at": found["observed_at"].isoformat(),
            "created_at": found["created_at"].isoformat(),
        }
    with closing(sqlite_connection()) as connection:
        workflow_store.ensure_local_workflow_tables(connection)
        found = connection.execute(
            "SELECT * FROM staff_reports WHERE report_ref=?", (case_reference,)
        ).fetchone()
        return dict(found) if found is not None else None


def persist_incident(payload: dict, sqlite_connection) -> tuple[dict, bool]:
    workflow_store.verify_persistence_config()
    identifier, reference = _identifier(payload)
    title = "External temperature observation requiring investigation"
    description = _canonical(payload)
    stamp = datetime.now(timezone.utc).isoformat()
    row = {
        "report_id": identifier,
        "report_ref": reference,
        "facility_code": payload["facility_id"],
        "category": "temperature_excursion",
        "title": title,
        "description": description,
        "observed_at": payload["observed_at"],
        "reported_by": "simulated_external_adapter",
        "created_at": stamp,
    }
    if len(description) > 3000:
        raise HTTPException(status_code=422, detail="Source metadata is too long.")

    inserted = False
    if workflow_store.use_postgres():
        with workflow_store._connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO tl_staff_reports
                       (report_id,report_ref,facility_code,category,title,description,
                        observed_at,reported_by,created_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (report_ref) DO NOTHING
                       RETURNING report_ref""",
                    (row["report_id"], row["report_ref"], row["facility_code"],
                     row["category"], row["title"], row["description"],
                     row["observed_at"], row["reported_by"], row["created_at"]),
                )
                inserted = cursor.fetchone() is not None
    else:
        with closing(sqlite_connection()) as connection, connection:
            workflow_store.ensure_local_workflow_tables(connection)
            cursor = connection.execute(
                """INSERT OR IGNORE INTO staff_reports
                    (report_id,report_ref,facility_code,category,title,description,
                     observed_at,reported_by,created_at)
                    VALUES (:report_id,:report_ref,:facility_code,:category,:title,
                     :description,:observed_at,:reported_by,:created_at)""",
                row,
            )
            inserted = cursor.rowcount == 1
    saved = lookup(reference, sqlite_connection)
    if not saved or saved["description"] != description:
        raise HTTPException(
            status_code=409,
            detail="That source event ID was already used for a different observation. No data was overwritten.",
        )
    return saved, inserted
