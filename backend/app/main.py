from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import base64
from datetime import datetime, timedelta, timezone
import hmac
import json
import os
import sqlite3
import time
from contextlib import closing
from typing import Any, Literal
from uuid import UUID

from app import workflow_store, case_flow, proof_lab, external_bridge, integration_feed, connector_credentials

import pandas as pd
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.pipeline import SAFE_MAX_C, SAFE_MIN_C, parse_timestamp_series

APP_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = APP_DIR.parent
OUTPUT_DIR = BACKEND_ROOT / "data" / "processed"
RAW_DIR = BACKEND_ROOT / "data" / "raw"
AUDIT_DB_PATH = Path(
    os.environ.get(
        "TRUSTLEDGER_AUDIT_DB_PATH",
        str(OUTPUT_DIR / "review_audit.sqlite3"),
    )
)

app = FastAPI(title="TrustLedger API", version="0.2.0", description="Cold-chain incident investigation prototype")
cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "TRUSTLEDGER_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    review_id: UUID
    incident_id: str = Field(min_length=1, max_length=80)
    decision: Literal["accept", "change", "reject"]
    reason: str = Field(min_length=5, max_length=1000)
    changed_assessment: str | None = Field(default=None, max_length=1000)

    @field_validator("incident_id", "reason", "changed_assessment", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_changed_assessment(self):
        if self.decision == "change" and not self.changed_assessment:
            raise ValueError("A changed assessment is required for a Change decision.")
        return self


class StaffReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facility_code: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    category: Literal["equipment_problem","monitoring_gap","temperature_excursion","sensor_anomaly","other"]
    title: str = Field(min_length=5, max_length=160)
    description: str = Field(min_length=10, max_length=3000)
    observed_at: datetime
    source_dataset: str | None = Field(default=None, max_length=40)
    source_record_id: str | None = Field(default=None, max_length=180)
    source_record_sha256: str | None = Field(default=None, min_length=64, max_length=64)

    @field_validator("title", "description", mode="before")
    @classmethod
    def clean_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("observed_at")
    @classmethod
    def explicit_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Observation time requires an explicit timezone offset")
        # Only worker-entered observation timestamps are constrained. Historical
        # ABBIS replay is validated by its separate source connector, not here.
        if value.astimezone(timezone.utc) > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Observation date cannot be in the future. Check the day, month, year and time.")
        return value


class InvestigationNoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    finding: str = Field(min_length=10, max_length=2000)

    @field_validator("finding", mode="before")
    @classmethod
    def clean_finding(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class InvestigationSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(min_length=10, max_length=2000)

    @field_validator("summary", mode="before")
    @classmethod
    def clean_summary(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class FollowupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=10, max_length=1000)
    due_at: datetime | None = None

    @field_validator("description", mode="before")
    @classmethod
    def clean_description(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("due_at")
    @classmethod
    def check_due_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Follow-up date must have a timezone offset.")
        return value


class CompleteFollowupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    completion_note: str = Field(min_length=10, max_length=2000)

    @field_validator("completion_note", mode="before")
    @classmethod
    def clean_completion(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class ClosureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=10, max_length=2000)

    @field_validator("reason", mode="before")
    @classmethod
    def clean_reason(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class DemoLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)
    remember_me: bool = False


class DemoUser(BaseModel):
    username: str
    actor_name: str
    role: Literal["facility_staff", "blood_service_supervisor"]


def _demo_auth_settings() -> tuple[str, dict[str, dict[str, str]]]:
    secret = os.environ.get("TRUSTLEDGER_AUTH_SECRET", "")
    cookie_samesite = os.environ.get("TRUSTLEDGER_COOKIE_SAMESITE", "lax").lower()
    cookie_secure = os.environ.get("TRUSTLEDGER_COOKIE_SECURE", "false").lower() == "true"
    accounts = {
        "facility_staff": {
            "username": os.environ.get("TRUSTLEDGER_DEMO_FACILITY_USERNAME", ""),
            "password": os.environ.get("TRUSTLEDGER_DEMO_FACILITY_PASSWORD", ""),
            "actor_name": os.environ.get("TRUSTLEDGER_DEMO_FACILITY_NAME", ""),
        },
        "blood_service_supervisor": {
            "username": os.environ.get("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME", ""),
            "password": os.environ.get("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD", ""),
            "actor_name": os.environ.get("TRUSTLEDGER_DEMO_SUPERVISOR_NAME", ""),
        },
    }
    if (
        len(secret) < 32
        or any(not all(account.values()) or len(account["password"]) < 12 for account in accounts.values())
        or cookie_samesite not in {"lax", "strict", "none"}
        or (cookie_samesite == "none" and not cookie_secure)
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Demo authentication is not configured. Set a 32-character auth secret, "
                "and both pre-provisioned demo accounts with passwords of at least 12 characters, "
                "and valid secure cookie settings."
            ),
        )
    if accounts["facility_staff"]["username"] == accounts["blood_service_supervisor"]["username"]:
        raise HTTPException(status_code=503, detail="Demo account usernames must be distinct.")
    if accounts["facility_staff"]["password"] == accounts["blood_service_supervisor"]["password"]:
        raise HTTPException(status_code=503, detail="Demo account passwords must be distinct.")
    return secret, accounts


def _session_cookie_value(user: DemoUser, secret: str, expires_at: int) -> str:
    payload = json.dumps(
        {
            "username": user.username,
            "actor_name": user.actor_name,
            "role": user.role,
            "expires_at": expires_at,
        },
        separators=(",", ":"),
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(secret.encode(), encoded.encode(), "sha256").hexdigest()
    return f"{encoded}.{signature}"


def _decode_session_cookie(value: str, secret: str, accounts: dict[str, dict[str, str]]) -> DemoUser:
    try:
        encoded, signature = value.rsplit(".", 1)
        expected = hmac.new(secret.encode(), encoded.encode(), "sha256").hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        data = json.loads(payload)
        if int(data["expires_at"]) <= int(time.time()):
            raise ValueError("Expired session")
        role = data["role"]
        account = accounts[role]
        if data["username"] != account["username"] or data["actor_name"] != account["actor_name"]:
            raise ValueError("Account no longer matches session")
        return DemoUser(username=data["username"], actor_name=data["actor_name"], role=role)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=401, detail="Login required or session expired.") from error


def require_authenticated_user(
    session: str | None = Cookie(default=None, alias="trustledger_session"),
) -> DemoUser:
    secret, accounts = _demo_auth_settings()
    if not session:
        raise HTTPException(status_code=401, detail="Login required.")
    return _decode_session_cookie(session, secret, accounts)


def _connect_audit_db() -> sqlite3.Connection:
    AUDIT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(AUDIT_DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS review_events (
            review_id TEXT PRIMARY KEY,
            incident_id TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('facility_staff', 'blood_service_supervisor')),
            decision TEXT NOT NULL CHECK (decision IN ('accept', 'change', 'reject')),
            reason TEXT NOT NULL,
            changed_assessment TEXT,
            created_at TEXT NOT NULL,
            auth_method TEXT NOT NULL DEFAULT 'legacy_self_reported'
                CHECK (auth_method IN ('legacy_self_reported', 'preprovisioned_demo_account'))
        );
        CREATE TRIGGER IF NOT EXISTS review_events_no_update
        BEFORE UPDATE ON review_events
        BEGIN
            SELECT RAISE(ABORT, 'review events are append-only');
        END;
        CREATE TRIGGER IF NOT EXISTS review_events_no_delete
        BEFORE DELETE ON review_events
        BEGIN
            SELECT RAISE(ABORT, 'review events are append-only');
        END;
        """
    )
    columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(review_events)")
    }
    if "auth_method" not in columns:
        connection.execute(
            "ALTER TABLE review_events ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'legacy_self_reported'"
        )
    return connection


def _review_dict(row: sqlite3.Row) -> dict:
    return {key: row[key] for key in row.keys()}


def read_json(name: str):
    path = OUTPUT_DIR / name
    if not path.exists():
        raise HTTPException(status_code=503, detail="Data pipeline has not been run yet. Run `python -m app.run_pipeline` first.")
    return json.loads(path.read_text(encoding="utf-8"))



# Synthetic-only judge demonstration. No writes to the real incident ledger.
class ImportContractObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["trustledger.observation.v1"]
    source_system: str = Field(min_length=2, max_length=100)
    source_event_id: str = Field(min_length=3, max_length=100)
    facility_id: str = Field(min_length=2, max_length=80)
    observed_at: datetime
    temperature_c: float

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("An explicit time-zone offset is required.")
        return value

    @field_validator("temperature_c")
    @classmethod
    def require_finite_temperature(cls, value: float) -> float:
        import math
        if not math.isfinite(value):
            raise ValueError("Temperature must be a finite numeric value.")
        return value


@app.get("/api/proof-lab/scenarios")
def proof_scenarios(user: DemoUser = Depends(require_authenticated_user)):
    return {"items": proof_lab.SCENARIOS, "notice": "Synthetic fixture challenge; does not access live devices or donor data."}


@app.post("/api/proof-lab/scenarios/{scenario_id}/run")
def run_proof_scenario(scenario_id: str, user: DemoUser = Depends(require_authenticated_user)):
    try:
        return proof_lab.run_scenario(scenario_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Unknown proof scenario.") from error


@app.get("/api/proof-lab/comparison")
def proof_comparison(user: DemoUser = Depends(require_authenticated_user)):
    return proof_lab.comparison_summary()


@app.post("/api/proof-lab/validate-import")
def validate_proposed_import(
    observation: ImportContractObservation,
    user: DemoUser = Depends(require_authenticated_user),
):
    return {
        "accepted_for_schema_validation": True,
        "schema_version": observation.schema_version,
        "source_event_id": observation.source_event_id,
        "facility_id": observation.facility_id,
        "source_system": observation.source_system,
        "persisted": False,
        "interoperability": "Proposed TrustLedger contract only; not an ABBIS, FHIR or HL7 integration.",
        "notice": "Shape and timezone validated. Sensor accuracy, facility authorization and real device provenance were not verified.",
    }



@app.post("/api/integrations/demo/observations")
def demo_observation_ingest(
    observation: ImportContractObservation,
    response: Response,
    user: DemoUser = Depends(require_authenticated_user),
):
    """Authenticated synthetic adapter simulation, not an open machine-to-machine API."""
    if user.role != "facility_staff":
        raise HTTPException(status_code=403, detail="Only the facility operator may simulate source ingestion.")
    reading = observation.temperature_c
    if reading in {-99.0, 99.9, 0.0}:
        raise HTTPException(status_code=422, detail="Known sentinel readings must be investigated as data-quality events, not temperature incidents.")
    if SAFE_MIN_C <= reading <= SAFE_MAX_C:
        return {
            "status": "in_range_not_recorded",
            "case_reference": None,
            "persisted": False,
            "notice": "Within the prototype temperature band; no incident raised. This demo does not retain routine in-range telemetry.",
        }
    report, created = external_bridge.persist_incident(
        observation.model_dump(mode="json"), _connect_audit_db
    )
    response.status_code = 201 if created else 200
    return {
        "status": "incident_created" if created else "already_imported",
        "case_reference": report["report_ref"],
        "persisted": True,
        "source_event_id": observation.source_event_id,
        "incident": _staff_incident(report),
        "notice": "Synthetic external observation stored as a provisional case. No clinical exposure or disposition has been verified.",
    }


@app.get("/api/integrations/demo/cases/{case_reference}")
def demo_connection_status(
    case_reference: str,
    user: DemoUser = Depends(require_authenticated_user),
):
    if not case_reference.startswith("EXT-"):
        raise HTTPException(status_code=404, detail="Simulated external incident not found.")
    report = external_bridge.lookup(case_reference, _connect_audit_db)
    if report is None:
        raise HTTPException(status_code=404, detail="Simulated external incident not found.")
    case = case_flow.get_case(case_reference, _connect_audit_db)
    return {
        "case_reference": case_reference,
        "source": "simulated_external_blood_bank",
        "source_system": external_bridge.unpack(report["description"])["source_system"],
        "source_event_id": external_bridge.unpack(report["description"])["source_event_id"],
        "investigation_status": case["status"],
        "review_events": [
            {"event_kind": event["event_kind"], "created_at": event["created_at"]}
            for event in case["events"]
        ],
        "clinical_clearance": None,
        "notice": "Read-only prototype status endpoint for a simulated partner; not a live ABBIS callback or patient-safety decision.",
    }



class NewConnectorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9 _.-]{2,99}$")
    source_system: str = Field(min_length=2, max_length=100, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9 _.-]{1,99}$")
    facility_code: str = Field(min_length=2, max_length=80, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$")


@app.post("/api/connections", status_code=201)
def register_connection(
    payload: NewConnectorRequest,
    response: Response,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only a supervisor can create an external system connection.")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return connector_credentials.create(
        payload.label, payload.source_system, payload.facility_code,
        user.username, _connect_audit_db,
    )


@app.get("/api/connections")
def list_connections(
    response: Response,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only a supervisor can manage external connections.")
    response.headers["Cache-Control"] = "no-store"
    return {"items": connector_credentials.list_all(_connect_audit_db)}


@app.post("/api/connections/{connection_id}/revoke")
def revoke_connection(
    connection_id: UUID,
    response: Response,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only a supervisor can revoke an external connection.")
    response.headers["Cache-Control"] = "no-store"
    return connector_credentials.revoke(str(connection_id), user.username, _connect_audit_db)


def _adapter_identity(
    connector_key: str | None = Header(default=None, alias="X-TrustLedger-Connector-Key"),
    session: str | None = Cookie(default=None, alias="trustledger_session"),
):
    """A scoped API key authenticates partner systems; demo staff can test replay."""
    if connector_key is not None:
        return connector_credentials.authenticate(connector_key, _connect_audit_db)
    actor = require_authenticated_user(session)
    if actor.role != "facility_staff":
        raise HTTPException(status_code=403, detail="Only a facility operator or authorized connector can send observations.")
    return actor


def _adapter_status_identity(
    connector_key: str | None = Header(default=None, alias="X-TrustLedger-Connector-Key"),
    session: str | None = Cookie(default=None, alias="trustledger_session"),
):
    """A scoped partner key or a signed-in demonstration user may read status."""
    if connector_key is not None:
        return connector_credentials.authenticate(connector_key, _connect_audit_db)
    return require_authenticated_user(session)


@app.get("/api/connectors/received-observations")
def received_connector_observations(
    limit: int = Query(default=12, ge=1, le=30),
    user: DemoUser = Depends(require_authenticated_user),
):
    """Operational receipt view. Distinct observations are not incident counts."""
    return integration_feed.recent_observations(_connect_audit_db, limit=limit)


@app.get("/api/connectors/v1/connection")
def verify_connector_access(
    response: Response,
    identity=Depends(_adapter_status_identity),
):
    response.headers["Cache-Control"] = "no-store"
    if not isinstance(identity, dict):
        return {"authenticated": True, "mode": "signed_in_demo_user", "connected": False}
    return {
        "authenticated": True,
        "connected": True,
        "mode": "scoped_connector_key",
        "source_system": identity["source_system"],
        "facility_code": identity["facility_code"],
        "notice": "Valid TrustLedger API credential. This does not confirm the external system has started sending records.",
    }


@app.get("/api/integrations/sandbox/sample")
def sandbox_source_series(user: DemoUser = Depends(require_authenticated_user)):
    """Select actual consecutive source readings from the pinned synthetic CSV files."""
    import pandas as pd
    incidents_file = OUTPUT_DIR / "incidents.csv"
    raw_file = RAW_DIR / "temperature_logs.csv"
    if not incidents_file.exists() or not raw_file.exists():
        raise HTTPException(status_code=503, detail="The pinned synthetic source has not been prepared.")
    incidents = pd.read_csv(incidents_file)
    incidents = incidents[incidents["severity"] == "sustained"].head(35)
    raw = pd.read_csv(raw_file, usecols=["facility_id", "recorded_at", "temp_c"])
    raw["recorded_at"] = parse_timestamp_series(raw["recorded_at"])
    raw["temp_c"] = pd.to_numeric(raw["temp_c"], errors="coerce")
    for _, candidate in incidents.iterrows():
        start = pd.Timestamp(candidate["start_time"])
        end = pd.Timestamp(candidate["end_time"])
        readings = raw[
            (raw["facility_id"] == candidate["facility_id"])
            & (raw["recorded_at"] >= start)
            & (raw["recorded_at"] < end)
            & (raw["temp_c"] > SAFE_MAX_C)
            & (raw["temp_c"] < 80)
        ].sort_values("recorded_at").drop_duplicates("recorded_at").head(4)
        if len(readings) != 4:
            continue
        if not readings["recorded_at"].diff().iloc[1:].eq(pd.Timedelta(hours=1)).all():
            continue
        data = []
        for row in readings.itertuples(index=False):
            stamp = row.recorded_at.strftime("%Y-%m-%dT%H:%M:%S+00:00")
            data.append({
                "schema_version": "trustledger.observation.v1",
                "source_system": "ABBIS Sandbox — pinned synthetic replay",
                "source_event_id": "SRC-" + row.facility_id + "-" + row.recorded_at.strftime("%Y%m%d%H%M"),
                "facility_id": row.facility_id,
                "observed_at": stamp,
                "temperature_c": float(row.temp_c),
            })
        return {
            "items": data,
            "source_incident_id": candidate["incident_id"],
            "mode": "Historical synthetic data replay, not live monitoring.",
            "source_revision": "da2862ff9db262f40cd1776fd7962ed47d8942ec",
            "timestamp_note": "Original CSV timestamps did not specify a timezone. UTC is assigned for synthetic transport demonstration only; real sources must provide an explicit offset.",
        }
    raise HTTPException(status_code=503, detail="No verified four-reading source sequence found in pinned synthetic data.")


@app.post("/api/connectors/v1/observations")
def receive_connector_observation(
    observation: ImportContractObservation,
    response: Response,
    identity: str = Depends(_adapter_identity),
):
    """Real observation store, deterministic rules and incident connection."""
    if isinstance(identity, dict) and (
        observation.source_system != identity["source_system"]
        or observation.facility_id != identity["facility_code"]
    ):
        raise HTTPException(status_code=403, detail="Connector key is not authorized for this source and facility.")
    result = integration_feed.ingest_observation(
        observation.model_dump(mode="json"), _connect_audit_db
    )
    response.status_code = 201 if result["observation_stored"] else 200
    response.headers["Cache-Control"] = "no-store"
    return result


@app.get("/api/connectors/v1/cases/{case_reference}")
def connector_case_status(
    case_reference: str,
    response: Response,
    identity: str = Depends(_adapter_status_identity),
):
    response.headers["Cache-Control"] = "no-store"
    if not case_reference.startswith("EXT-"):
        raise HTTPException(status_code=404, detail="Case not found.")
    saved = external_bridge.lookup(case_reference, _connect_audit_db)
    if not saved:
        raise HTTPException(status_code=404, detail="Case not found.")
    state = case_flow.get_case(case_reference, _connect_audit_db)
    source = external_bridge.unpack(saved["description"])
    if isinstance(identity, dict) and (
        source["source_system"] != identity["source_system"]
        or source["facility_id"] != identity["facility_code"]
    ):
        raise HTTPException(status_code=404, detail="Case not found.")
    return {
        "case_reference": case_reference,
        "source_system": source["source_system"],
        "source_event_id": source["source_event_id"],
        "investigation_status": state["status"],
        "review_events": [
            {"event_kind": e["event_kind"], "actor_role": e["actor_role"],
             "created_at": e["created_at"]} for e in state["events"]
        ],
        "clinical_clearance": None,
        "delivery_mode": "Authenticated pull; push webhooks not implemented.",
    }



@app.get("/api/connectors/v1/cases")
def list_partner_cases(
    response: Response,
    limit: int = Query(default=30, ge=1, le=50),
    identity=Depends(_adapter_status_identity),
):
    """Outbound pull feed: list current partner-scoped case status snapshots."""
    response.headers["Cache-Control"] = "no-store"
    if not isinstance(identity, dict):
        raise HTTPException(status_code=403, detail="An active connector API key is required for this feed.")
    source_system, facility_code = identity["source_system"], identity["facility_code"]
    workflow_store.verify_persistence_config()
    if workflow_store.use_postgres():
        from psycopg.rows import dict_row
        with workflow_store._connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """SELECT report_ref FROM tl_staff_reports
                    WHERE report_ref LIKE 'EXT-%'
                      AND facility_code=%s
                      AND description::jsonb->>'source_system'=%s
                    ORDER BY created_at DESC LIMIT %s""",
                    (facility_code, source_system, limit),
                )
                references=[r["report_ref"] for r in cursor.fetchall()]
    else:
        with closing(_connect_audit_db()) as connection:
            workflow_store.ensure_local_workflow_tables(connection)
            rows=connection.execute(
                """SELECT report_ref,description FROM staff_reports
                   WHERE report_ref LIKE 'EXT-%' AND facility_code=?
                   ORDER BY created_at DESC LIMIT 1000""", (facility_code,)
            ).fetchall()
        references=[
            r["report_ref"] for r in rows
            if external_bridge.unpack(r["description"])["source_system"] == source_system
        ][:limit]
    return {
        "items": [
            {
                "case_reference": ref,
                "investigation_status": case_flow.get_case(ref, _connect_audit_db)["status"],
            } for ref in references
        ],
        "clinical_clearance": None,
        "delivery_mode": "authenticated_polling",
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "trustledger-api"}


@app.get("/api/config")
def site_config(user: DemoUser = Depends(require_authenticated_user)):
    return {
        "site_name": os.environ.get("TRUSTLEDGER_SITE_NAME", "TrustLedger"),
        "country": os.environ.get("TRUSTLEDGER_COUNTRY", "Kenya"),
        "temperature_policy": {"minimum_c": SAFE_MIN_C, "maximum_c": SAFE_MAX_C},
        "identity_mode": "environment_provisioned_demo_account",
    }


@app.get("/api/dashboard")
def dashboard(user: DemoUser = Depends(require_authenticated_user)):
    import pandas as pd
    incidents_path = OUTPUT_DIR / "incidents.csv"
    if not incidents_path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    summary = read_json("pipeline_summary.json")
    df = pd.read_csv(incidents_path)
    if df.empty:
        summary["incident_trends"] = []
        summary["facility_monitoring"] = []
        return summary

    df["start_time"] = parse_timestamp_series(df["start_time"])
    df["month"] = df["start_time"].dt.to_period("M")
    trends = []
    for month, group in df.groupby("month", sort=True):
        trends.append({
            "month": month.strftime("%b %Y"),
            "warning_count": int((group["severity"] == "warning").sum()),
            "sustained_count": int((group["severity"] == "sustained").sum()),
        })

    facilities = []
    for facility_id, group in df.groupby("facility_id", sort=True):
        latest = group["start_time"].max()
        facilities.append({
            "facility_id": facility_id,
            "incident_count": int(len(group)),
            "sustained_count": int((group["severity"] == "sustained").sum()),
            "latest_incident_at": latest.strftime("%Y-%m-%d %H:%M:%S") if pd.notna(latest) else None,
        })
    facilities.sort(key=lambda facility: (-facility["sustained_count"], -facility["incident_count"], facility["facility_id"]))
    summary["incident_trends"] = trends
    summary["facility_monitoring"] = facilities
    return summary


def _external_observation_rows(payload: dict) -> list[dict]:
    """Rehydrate *actual* connector evidence already saved with the case.

    Four hourly samples create one provisional case, not four cases. The
    original four observations are stored inside the append-only external
    case payload, so no migration or fabricated timeseries is needed.
    """
    source_rows = payload.get("episode_readings")
    if not isinstance(source_rows, list) or not source_rows:
        source_rows = [payload]
    records = []
    seen = set()
    for row in source_rows:
        if not isinstance(row, dict):
            continue
        when, event_id = row.get("observed_at"), row.get("source_event_id")
        try:
            temperature = float(row["temperature_c"])
            parsed = datetime.fromisoformat(str(when).replace("Z", "+00:00"))
        except (ValueError, TypeError, KeyError):
            continue
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            continue
        identity = (str(when), str(event_id))
        if identity in seen:
            continue
        seen.add(identity)
        records.append({
            "recorded_at": parsed.isoformat(),
            "temp_c": temperature,
            "quality_status": "valid",
            "source_event_id": str(event_id or "not provided"),
        })
    return sorted(records, key=lambda row: row["recorded_at"])


def _staff_observation_is_future(report: dict) -> bool:
    """Flag existing worker-entered future timestamps without changing evidence."""
    if report["report_ref"].startswith("EXT-"):
        return False
    try:
        observed = datetime.fromisoformat(
            str(report["observed_at"]).replace("Z", "+00:00")
        )
        return observed.tzinfo is not None and (
            observed.astimezone(timezone.utc) > datetime.now(timezone.utc) + timedelta(minutes=5)
        )
    except (ValueError, TypeError):
        return False


def _staff_incident(report: dict) -> dict:
    external = report["report_ref"].startswith("EXT-")
    payload = external_bridge.unpack(report["description"]) if external else None
    observations = _external_observation_rows(payload) if external else []
    values = [item["temp_c"] for item in observations]
    first = observations[0]["recorded_at"] if observations else report["observed_at"]
    last = observations[-1]["recorded_at"] if observations else report["observed_at"]
    observed_span_hours = None
    if external and len(observations) >= 2:
        earliest = datetime.fromisoformat(observations[0]["recorded_at"])
        latest = datetime.fromisoformat(observations[-1]["recorded_at"])
        observed_span_hours = round((latest - earliest).total_seconds() / 3600, 2)
    return {
        "incident_id": report["report_ref"],
        "facility_id": report["facility_code"],
        "recorded_at": report.get("created_at"),
        "observation_date_in_future": _staff_observation_is_future(report),
        "start_time": first if external else report["observed_at"],
        "end_time": last if external else report["observed_at"],
        # The span between first and last observed readings is measurable.
        # It is NOT the duration of exposure or the duration of a clinical incident.
        "duration_hours": None,
        "observation_span_hours": observed_span_hours,
        "reading_count": len(observations) if external else None,
        "peak_temp_c": max(values) if values else None,
        "minimum_temp_c": min(values) if values else None,
        "direction": ("above_range" if values and min(values) > SAFE_MAX_C else
                      "below_range" if values and max(values) < SAFE_MIN_C else
                      "observed_excursion") if external else "staff_report",
        "severity": "sustained" if external and len(observations) >= 4 else "warning" if external else "needs_review",
        "sustained_rule": payload.get("detection_rule", "Connector observation requires review; exposure duration not established.") if external else "Reported by staff. No automatic temperature evidence established.",
        "report_title": report["title"],
        "report_description": ("Source observations received through the authenticated connector. No clinical safety determination has been made." if external else report["description"]),
        "source_type": "external_observation" if external else "staff_report",
        "source_system": payload["source_system"] if external else None,
        "source_event_id": payload["source_event_id"] if external else None,
        "source_payload": payload if external else None,
    }


def _case_exists(case_reference: str) -> bool:
    if case_reference.startswith(("REP-", "EXT-")):
        return any(row["report_ref"] == case_reference for row in workflow_store.list_staff_reports(_connect_audit_db))
    incidents_path = OUTPUT_DIR / "incidents.csv"
    if not incidents_path.exists():
        return False
    return case_reference in set(pd.read_csv(incidents_path, usecols=["incident_id"])["incident_id"].astype(str))



ABBIS_DATASETS = frozenset({
    "facilities","routes","donors","drives","donations","units",
    "transfers","requests","daily_stock","power_outages","temperature_logs",
})


def _abbis_request(endpoint: str, params: dict[str, str]) -> dict:
    """Read-only, bounded request to the fixed ABBIS source hostname."""
    url = "https://abbis-source-sandbox.vercel.app" + endpoint
    if params:
        url += "?" + urlencode(params)
    try:
        with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=12) as response:
            payload = response.read(200001)
        if len(payload)>200000:
            raise ValueError("Source response too large")
        result=json.loads(payload)
        if not isinstance(result,dict):
            raise ValueError("Invalid source result")
        return result
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="ABBIS source unavailable. No changes saved.") from error


@app.get("/api/abbis/catalog")
def abbis_catalog(user: DemoUser = Depends(require_authenticated_user)):
    result=_abbis_request("/api/catalog",{})
    datasets=result.get("dataset_summaries")
    if not isinstance(datasets,list) or len(datasets)!=11:
        raise HTTPException(status_code=503,detail="The complete ABBIS dataset is not yet available.")
    return {"datasets":[{"id":item["id"],"count":item["count"]} for item in datasets
                        if item.get("id") in ABBIS_DATASETS],
            "source_revision":result.get("organizer_archive_sha256")}


@app.get("/api/abbis/records/search")
def abbis_records_search(dataset: str=Query(min_length=2,max_length=40),
                         q: str=Query(min_length=2,max_length=180),
                         user: DemoUser=Depends(require_authenticated_user)):
    if dataset not in ABBIS_DATASETS:
        raise HTTPException(status_code=422,detail="Unknown source dataset")
    result=_abbis_request("/api/records/search",{"dataset":dataset,"q":q,"limit":"15"})
    if result.get("dataset")!=dataset or not isinstance(result.get("items"),list):
        raise HTTPException(status_code=503,detail="ABBIS returned invalid source search")
    return result


def _verified_abbis_record(dataset: str, record_id: str, digest: str) -> dict:
    if dataset not in ABBIS_DATASETS or len(record_id)>180 or len(digest)!=64:
        raise HTTPException(status_code=422, detail="Invalid ABBIS source reference")
    result=_abbis_request("/api/records/lookup",{"dataset":dataset,"record_id":record_id})
    if (result.get("dataset")!=dataset or result.get("record_id")!=record_id
        or result.get("record_sha256")!=digest or
        result.get("source_system")!="ABBIS-SANDBOX"):
        raise HTTPException(status_code=409,detail="Selected ABBIS record does not match the verified source")
    return result


@app.post("/api/incidents/report", status_code=201)
def report_incident(
    report: StaffReportRequest,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "facility_staff":
        raise HTTPException(status_code=403, detail="Only facility staff may create an incident report.")
    source_fields = ("source_dataset","source_record_id","source_record_sha256")
    supplied = [bool(getattr(report, key)) for key in source_fields]
    if any(supplied) and not all(supplied):
        raise HTTPException(status_code=422, detail="Select a complete ABBIS source record or report independently.")
    data = report.model_dump(exclude={"observed_at", *source_fields})
    if all(supplied):
        original = _verified_abbis_record(
            report.source_dataset, report.source_record_id, report.source_record_sha256
        )
        if original.get("facility_id") != report.facility_code:
            raise HTTPException(status_code=422, detail="Facility must match the selected ABBIS source record.")
        data["description"] += (
            "\n\nVerified ABBIS source record: " + report.source_dataset + " / " + report.source_record_id
            + "\nOriginal source SHA256: " + report.source_record_sha256
            + "\nOrganizer dataset revision: " + str(original.get("source_revision"))
        )
    saved = workflow_store.create_staff_report(
        {**data, "observed_at": report.observed_at.isoformat()},
        user.username,
        _connect_audit_db,
    )
    return {"incident": _staff_incident(saved), "notice": "Staff observation recorded. This is not a verified temperature measurement."}


@app.get("/api/incidents/{incident_id}/notes")
def incident_notes(incident_id: str, user: DemoUser = Depends(require_authenticated_user)):
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"items": workflow_store.list_investigation_notes(incident_id, _connect_audit_db)}


@app.post("/api/incidents/{incident_id}/notes", status_code=201)
def add_incident_note(
    incident_id: str,
    payload: InvestigationNoteRequest,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "facility_staff":
        raise HTTPException(status_code=403, detail="Only facility staff may record investigation findings.")
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    state = case_flow.get_case(incident_id, _connect_audit_db)
    if state["status"] not in ("investigating", "returned"):
        raise HTTPException(status_code=409, detail="Investigation notes are locked while the case is under review or follow-up.")
    note = workflow_store.add_investigation_note(incident_id, payload.finding, user, _connect_audit_db)
    return {"note": note, "notice": "Staff finding recorded. No clinical disposition authorized."}


@app.get("/api/case-history")
def case_history(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: DemoUser = Depends(require_authenticated_user),
):
    return case_flow.recent_history(limit, offset, _connect_audit_db)


@app.get("/api/review-queue")
def review_queue(user: DemoUser = Depends(require_authenticated_user)):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only a supervisor can access the review queue.")
    return {"items": case_flow.awaiting_review(_connect_audit_db)}


@app.get("/api/incidents/{incident_id}/workflow")
def incident_workflow(incident_id: str, user: DemoUser = Depends(require_authenticated_user)):
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return case_flow.get_case(incident_id, _connect_audit_db)


@app.post("/api/incidents/{incident_id}/submit")
def submit_investigation(
    incident_id: str,
    payload: InvestigationSubmissionRequest,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "facility_staff":
        raise HTTPException(status_code=403, detail="Only facility staff may submit an investigation.")
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return case_flow.submit(incident_id, user, payload.summary, _connect_audit_db)


@app.post("/api/incidents/{incident_id}/followups", status_code=201)
def create_followup(
    incident_id: str,
    payload: FollowupRequest,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only a supervisor may assign follow-up.")
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    _, accounts = _demo_auth_settings()
    assignee = accounts["facility_staff"]["username"]
    return case_flow.create_followup(
        incident_id, user, assignee, payload.description,
        payload.due_at.isoformat() if payload.due_at else None, _connect_audit_db,
    )


@app.post("/api/incidents/{incident_id}/followups/{action_id}/complete")
def complete_followup(
    incident_id: str,
    action_id: UUID,
    payload: CompleteFollowupRequest,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "facility_staff":
        raise HTTPException(status_code=403, detail="Only assigned staff may complete follow-up.")
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return case_flow.complete_followup(
        incident_id, str(action_id), user, payload.completion_note, _connect_audit_db,
    )


@app.post("/api/incidents/{incident_id}/close")
def close_incident(
    incident_id: str,
    payload: ClosureRequest,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only the supervisor may close a case.")
    if not _case_exists(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return case_flow.close(incident_id, user, payload.reason, _connect_audit_db)


@app.get("/api/incidents")
def incidents(
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    view: Literal["all", "active", "historical"] = "all",
    user: DemoUser = Depends(require_authenticated_user),
):
    import pandas as pd
    path = OUTPUT_DIR / "incidents.csv"
    if view in ("all", "historical") and not path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    manual = [_staff_incident(r) for r in workflow_store.list_staff_reports(_connect_audit_db)]
    if view == "active":
        df = pd.DataFrame(manual)
    elif view == "historical":
        df = pd.read_csv(path)
    else:
        df = pd.read_csv(path)
        if manual:
            df = pd.concat([pd.DataFrame(manual), df], ignore_index=True)
    if search:
        searchable = [column for column in ["incident_id", "facility_id", "severity", "direction", "report_title"] if column in df]
        matched = df[searchable].fillna("").astype(str).apply(
            lambda column: column.str.contains(search, case=False, regex=False)
        ).any(axis=1)
        df = df[matched]
    total = int(len(df))
    rows = df.iloc[offset:offset + limit]
    return {
        "items": rows.astype(object).where(pd.notna(rows), None).to_dict("records"),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/transport-alerts")
def transport_alerts(
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    user: DemoUser = Depends(require_authenticated_user),
):
    import pandas as pd
    path = OUTPUT_DIR / "transport_temperature_alerts.csv"
    if not path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    df = pd.read_csv(path)
    if search:
        searchable = [
            column for column in [
                "transfer_id", "unit_id", "component", "blood_group",
                "from_facility_id", "to_facility_id", "transfer_type", "transport_mode",
            ] if column in df
        ]
        matched = df[searchable].fillna("").astype(str).apply(
            lambda column: column.str.contains(search, case=False, regex=False)
        ).any(axis=1)
        df = df[matched]
    rows = df.iloc[offset:offset + limit]
    return {
        "items": rows.astype(object).where(pd.notna(rows), None).to_dict("records"),
        "total": int(len(df)),
        "limit": limit,
        "offset": offset,
        "notice": (
            "Transport evidence only: cool-box maximum readings above the configured "
            "RBC/WB threshold are investigation flags, not proof of unit exposure or "
            "a product disposition decision."
        ),
        "temperature_policy": {"minimum_c": SAFE_MIN_C, "maximum_c": SAFE_MAX_C},
    }


@app.get("/api/data-quality")
def data_quality(user: DemoUser = Depends(require_authenticated_user)):
    return read_json("pipeline_summary.json")["temperature_quality"]


@app.post("/api/auth/login")
def login(credentials: DemoLoginRequest, response: Response):
    secret, accounts = _demo_auth_settings()
    authenticated: DemoUser | None = None
    for role, account in accounts.items():
        username_matches = hmac.compare_digest(
            credentials.username.encode("utf-8"), account["username"].encode("utf-8")
        )
        password_matches = hmac.compare_digest(
            credentials.password.encode("utf-8"), account["password"].encode("utf-8")
        )
        if username_matches and password_matches:
            authenticated = DemoUser(
                username=account["username"],
                actor_name=account["actor_name"],
                role=role,
            )
    if authenticated is None:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # A signed HttpOnly cookie is persistent only when a user opts in.
    # Do not save the password in browser storage or change access roles.
    max_age = 7 * 24 * 60 * 60 if credentials.remember_me else 8 * 60 * 60
    response.set_cookie(
        key="trustledger_session",
        value=_session_cookie_value(authenticated, secret, int(time.time()) + max_age),
        max_age=max_age,
        httponly=True,
        secure=os.environ.get("TRUSTLEDGER_COOKIE_SECURE", "false").lower() == "true",
        samesite=os.environ.get("TRUSTLEDGER_COOKIE_SAMESITE", "lax").lower(),
        path="/api",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"user": authenticated.model_dump(), "expires_in": max_age}


@app.get("/api/auth/me")
def current_demo_user(
    response: Response,
    user: DemoUser = Depends(require_authenticated_user),
):
    response.headers["Cache-Control"] = "no-store"
    return user.model_dump()


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(
        key="trustledger_session",
        httponly=True,
        secure=os.environ.get("TRUSTLEDGER_COOKIE_SECURE", "false").lower() == "true",
        samesite=os.environ.get("TRUSTLEDGER_COOKIE_SAMESITE", "lax").lower(),
        path="/api",
    )
    return {"status": "logged_out"}


@app.post("/api/reviews")
def create_review(
    submission: ReviewSubmission,
    user: DemoUser = Depends(require_authenticated_user),
):
    if user.role != "blood_service_supervisor":
        raise HTTPException(status_code=403, detail="Only a separate supervisor account may record a review.")
    if not _case_exists(submission.incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    record = submission.model_dump(mode="json")
    record["actor_username"] = user.username
    record["actor_name"] = user.actor_name
    record["role"] = user.role
    record["created_at"] = datetime.now(timezone.utc).isoformat()
    record["auth_method"] = "preprovisioned_demo_account"
    saved, created = case_flow.review(submission.incident_id, user, record, _connect_audit_db)
    return {
        "status": "recorded" if created else "already_recorded",
        "review": saved,
        "notice": "Reviewer identity is verified against a pre-provisioned demo account; this is prototype authentication, not production identity management.",
    }


@app.get("/api/reviews")
@app.get("/api/audit-log")
def review_audit_log(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: DemoUser = Depends(require_authenticated_user),
):
    items,total=workflow_store.reviews(limit,offset,_connect_audit_db)
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "notice": "Review of investigation flags only. Audit records are shared in Neon when configured; demo identities are not production authentication.",
    }


@app.get("/api/power-correlations")
def power_correlations(
    limit: int = 100,
    user: DemoUser = Depends(require_authenticated_user),
):
    import pandas as pd
    path = OUTPUT_DIR / "incident_power_correlations.csv"
    if not path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    df = pd.read_csv(path)
    return {"items": df.head(max(1, min(limit, 500))).astype(object).where(pd.notna(df), None).to_dict("records"), "total": int(len(df))}


@app.get("/api/units/affected/{incident_id}")
def affected_units(
    incident_id: str,
    user: DemoUser = Depends(require_authenticated_user),
):
    import pandas as pd
    path = OUTPUT_DIR / "potentially_affected_units.csv"
    if not path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    df = pd.read_csv(path)
    rows = df[df["incident_id"] == incident_id].copy()
    # Dataset exposure labels are evaluation-only and must not be shown as model output.
    rows = rows.drop(columns=["temp_excursion_exposed_label"], errors="ignore")
    return {"items": rows.astype(object).where(pd.notna(rows), None).to_dict("records"), "total": int(len(rows))}


@app.get("/api/units/affected")
def affected_units_list(
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    strategy: Literal["sustained", "baseline"] = "sustained",
    user: DemoUser = Depends(require_authenticated_user),
):
    import pandas as pd
    filename = "baseline_candidate_units.csv" if strategy == "baseline" else "potentially_affected_units.csv"
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    df = pd.read_csv(path).drop(columns=["temp_excursion_exposed_label"], errors="ignore")
    if search:
        searchable = [column for column in ["unit_id", "incident_id", "facility_id", "component", "blood_group", "unit_status"] if column in df]
        matched = df[searchable].fillna("").astype(str).apply(
            lambda column: column.str.contains(search, case=False, regex=False)
        ).any(axis=1)
        df = df[matched]
    total = int(len(df))
    rows = df.iloc[offset:offset + limit]
    return {
        "items": rows.astype(object).where(pd.notna(rows), None).to_dict("records"),
        "total": total,
        "limit": limit,
        "offset": offset,
        "strategy": strategy,
        "notice": (
            "Fallback baseline: any out-of-range reading can create a candidate. Review the broader list; do not infer product disposition."
            if strategy == "baseline"
            else "Investigation candidates only. A qualified person must assess and decide disposition."
        ),
    }


@app.get("/api/incidents/{incident_id}")
def incident_detail(
    incident_id: str,
    user: DemoUser = Depends(require_authenticated_user),
):
    if incident_id.startswith(("REP-", "EXT-")):
        found = next(
            (report for report in workflow_store.list_staff_reports(_connect_audit_db)
             if report["report_ref"] == incident_id),
            None,
        )
        if found is None:
            raise HTTPException(status_code=404, detail="Incident not found")
        external = incident_id.startswith("EXT-")
        incident = _staff_incident(found)
        observation_rows = (
            _external_observation_rows(external_bridge.unpack(found["description"]))
            if external else []
        )
        return {
            "incident": incident,
            "potentially_affected_units": [],
            "temperature_history": observation_rows,
            "power_correlations": [],
            "decision_required": True,
            "notice": (
                "The source application sent these timestamped synthetic observations over the connector. Four consecutive hourly readings produce one provisional investigation; sensor identity, causation and individual blood-unit exposure are not established."
                if external
                else "Staff-reported issue only. No temperature measurement, cause, unit exposure or clinical safety claim established."
            ),
            "temperature_policy": {"minimum_c": SAFE_MIN_C, "maximum_c": SAFE_MAX_C},
        }
    import pandas as pd
    incident_path = OUTPUT_DIR / "incidents.csv"
    affected_path = OUTPUT_DIR / "potentially_affected_units.csv"
    history_path = RAW_DIR / "temperature_logs.csv"
    correlations_path = OUTPUT_DIR / "incident_power_correlations.csv"
    if not incident_path.exists() or not affected_path.exists() or not history_path.exists() or not correlations_path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    incidents_df = pd.read_csv(incident_path)
    found = incidents_df[incidents_df["incident_id"] == incident_id]
    if found.empty:
        raise HTTPException(status_code=404, detail="Incident not found")
    affected = pd.read_csv(affected_path)
    units = affected[affected["incident_id"] == incident_id].drop(columns=["temp_excursion_exposed_label"], errors="ignore")
    incident = found.iloc[0].astype(object).where(pd.notna(found.iloc[0]), None).to_dict()

    history = pd.read_csv(history_path)
    required_history_columns = {"facility_id", "recorded_at", "temp_c"}
    if not required_history_columns.issubset(history.columns):
        raise HTTPException(status_code=503, detail="Temperature history source is missing required columns.")
    history["recorded_at"] = parse_timestamp_series(history["recorded_at"])
    history["temp_c"] = pd.to_numeric(history["temp_c"], errors="coerce")
    incident_start = parse_timestamp_series(pd.Series([incident["start_time"]])).iloc[0]
    incident_end = parse_timestamp_series(pd.Series([incident["end_time"]])).iloc[0]
    history = history[
        (history["facility_id"] == incident["facility_id"])
        & history["recorded_at"].between(incident_start - pd.Timedelta(hours=6), incident_end + pd.Timedelta(hours=6))
    ].sort_values("recorded_at")
    temperature_history = []
    for row in history.itertuples(index=False):
        is_glitch = row.temp_c in {-99.0, 99.9, 0.0}
        temperature_history.append({
            "recorded_at": row.recorded_at.strftime("%Y-%m-%d %H:%M:%S"),
            "temp_c": None if is_glitch or pd.isna(row.temp_c) else float(row.temp_c),
            "quality_status": "known_sensor_glitch" if is_glitch else "valid",
        })

    correlations = pd.read_csv(correlations_path)
    correlations = correlations[correlations["incident_id"] == incident_id]
    return {
        "incident": incident,
        "potentially_affected_units": units.astype(object).where(pd.notna(units), None).to_dict("records"),
        "temperature_history": temperature_history,
        "power_correlations": correlations.astype(object).where(pd.notna(correlations), None).to_dict("records"),
        "decision_required": True,
        "notice": "Investigation candidates only. A qualified person must assess and decide disposition.",
        "temperature_policy": {"minimum_c": SAFE_MIN_C, "maximum_c": SAFE_MAX_C},
    }
