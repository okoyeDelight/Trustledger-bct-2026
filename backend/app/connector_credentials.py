"""Self-service, source- and facility-scoped connector credentials.

API tokens are securely generated, returned once, and never retained in
plaintext. Database inserts and revocations are append-only. Designed as a
working integration adapter; not production hospital identity management.
"""
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import secrets
from uuid import uuid4

from fastapi import HTTPException
from app import workflow_store


def _local_schema(connection):
    connection.executescript("""
    CREATE TABLE IF NOT EXISTS connector_keys (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, source_system TEXT NOT NULL,
      facility_code TEXT NOT NULL, key_prefix TEXT NOT NULL,
      key_sha256 TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connector_key_revocations (
      key_id TEXT PRIMARY KEY, revoked_by TEXT NOT NULL,
      revoked_at TEXT NOT NULL, FOREIGN KEY(key_id) REFERENCES connector_keys(id)
    );
    CREATE TRIGGER IF NOT EXISTS connector_keys_no_update BEFORE UPDATE ON connector_keys
    BEGIN SELECT RAISE(ABORT,'connector keys are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS connector_keys_no_delete BEFORE DELETE ON connector_keys
    BEGIN SELECT RAISE(ABORT,'connector keys are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS connector_revocations_no_update BEFORE UPDATE ON connector_key_revocations
    BEGIN SELECT RAISE(ABORT,'connector revocations are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS connector_revocations_no_delete BEFORE DELETE ON connector_key_revocations
    BEGIN SELECT RAISE(ABORT,'connector revocations are append-only'); END;
    """)


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _metadata(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "label": row["label"],
        "source_system": row["source_system"],
        "facility_code": row["facility_code"],
        "key_prefix": row["key_prefix"],
        "created_by": row["created_by"],
        "created_at": str(row["created_at"]),
        "revoked": bool(row.get("revoked")),
        "last_observation_at": str(row["last_observation_at"]) if row.get("last_observation_at") else None,
    }


def create(label: str, source: str, facility: str, owner: str, sqlite_connection):
    workflow_store.verify_persistence_config()
    raw = "tlc_" + secrets.token_urlsafe(32)
    created = datetime.now(timezone.utc).isoformat()
    row = {
        "id": str(uuid4()), "label": label, "source_system": source,
        "facility_code": facility, "key_prefix": raw[:13] + "…",
        "key_sha256": _hash(raw), "created_by": owner, "created_at": created,
    }
    if workflow_store.use_postgres():
        with workflow_store._connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO tl_connector_keys
                    (id,label,source_system,facility_code,key_prefix,key_sha256,created_by,created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    tuple(row.values()),
                )
    else:
        with closing(sqlite_connection()) as connection:
            _local_schema(connection)
            with connection:
                connection.execute(
                    """INSERT INTO connector_keys
                    (id,label,source_system,facility_code,key_prefix,key_sha256,created_by,created_at)
                    VALUES (:id,:label,:source_system,:facility_code,:key_prefix,:key_sha256,:created_by,:created_at)""",
                    row,
                )
    return {**_metadata(row), "key": raw, "revoked": False}


def _lookup(raw: str, sqlite_connection):
    if not raw or not raw.startswith("tlc_") or len(raw) > 100:
        return None
    workflow_store.verify_persistence_config()
    digest = _hash(raw)
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """SELECT k.id,k.label,k.source_system,k.facility_code,k.key_prefix,
                       k.created_by,k.created_at,(r.key_id IS NOT NULL) AS revoked
                       FROM tl_connector_keys k
                       LEFT JOIN tl_connector_key_revocations r ON r.key_id=k.id
                       WHERE k.key_sha256=%s""",
                    (digest,),
                )
                found=cursor.fetchone()
        return dict(found) if found else None
    with closing(sqlite_connection()) as connection:
        _local_schema(connection)
        found=connection.execute(
            """SELECT k.id,k.label,k.source_system,k.facility_code,k.key_prefix,
               k.created_by,k.created_at,(r.key_id IS NOT NULL) AS revoked
               FROM connector_keys k
               LEFT JOIN connector_key_revocations r ON r.key_id=k.id
               WHERE k.key_sha256=?""",
            (digest,),
        ).fetchone()
        return dict(found) if found else None


def authenticate(raw: str | None, sqlite_connection):
    found = _lookup(raw or "", sqlite_connection)
    if not found or found["revoked"]:
        raise HTTPException(401, "Connector API key is invalid or revoked.")
    return {
        "kind": "partner",
        "connector_id": str(found["id"]),
        "source_system": found["source_system"],
        "facility_code": found["facility_code"],
    }


def list_all(sqlite_connection):
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """SELECT k.id,k.label,k.source_system,k.facility_code,k.key_prefix,
                       k.created_by,k.created_at,(r.key_id IS NOT NULL) AS revoked,
                       (SELECT max(o.received_at) FROM tl_connector_observations o
                        WHERE o.source_system=k.source_system AND o.facility_id=k.facility_code)
                        AS last_observation_at
                       FROM tl_connector_keys k
                       LEFT JOIN tl_connector_key_revocations r ON r.key_id=k.id
                       ORDER BY k.created_at DESC LIMIT 100"""
                )
                rows=cursor.fetchall()
        return [_metadata(dict(row)) for row in rows]
    with closing(sqlite_connection()) as connection:
        _local_schema(connection)
        from app.integration_feed import _init_sqlite
        _init_sqlite(connection)
        rows=connection.execute(
            """SELECT k.id,k.label,k.source_system,k.facility_code,k.key_prefix,
               k.created_by,k.created_at,(r.key_id IS NOT NULL) AS revoked,
               (SELECT max(o.received_at) FROM connector_observations o
                WHERE o.source_system=k.source_system AND o.facility_id=k.facility_code)
                AS last_observation_at
               FROM connector_keys k
               LEFT JOIN connector_key_revocations r ON r.key_id=k.id
               ORDER BY k.created_at DESC LIMIT 100"""
        ).fetchall()
        return [_metadata(dict(row)) for row in rows]


def revoke(identifier: str, owner: str, sqlite_connection):
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute("SELECT id FROM tl_connector_keys WHERE id=%s", (identifier,))
                if not cursor.fetchone():
                    raise HTTPException(404, "Connection does not exist.")
                cursor.execute(
                    """INSERT INTO tl_connector_key_revocations(key_id,revoked_by)
                       VALUES(%s,%s) ON CONFLICT (key_id) DO NOTHING""",
                    (identifier,owner),
                )
    else:
        with closing(sqlite_connection()) as connection:
            _local_schema(connection)
            with connection:
                row=connection.execute("SELECT id FROM connector_keys WHERE id=?", (identifier,)).fetchone()
                if not row:
                    raise HTTPException(404, "Connection does not exist.")
                connection.execute(
                    """INSERT OR IGNORE INTO connector_key_revocations
                       (key_id,revoked_by,revoked_at) VALUES(?,?,?)""",
                    (identifier,owner,datetime.now(timezone.utc).isoformat()),
                )
    return {"revoked": True, "connection_id": identifier}
