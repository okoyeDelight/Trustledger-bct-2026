from pathlib import Path
import base64
from datetime import datetime, timezone
import hmac
import json
import os
import sqlite3
import time
from contextlib import closing
from typing import Any, Literal
from uuid import UUID

import pandas as pd
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Response
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


class DemoLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


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


def _record_review(submission: ReviewSubmission, user: DemoUser) -> tuple[dict, bool]:
    record = submission.model_dump(mode="json")
    record["actor_name"] = user.actor_name
    record["role"] = user.role
    record["created_at"] = datetime.now(timezone.utc).isoformat()
    record["auth_method"] = "preprovisioned_demo_account"
    with closing(_connect_audit_db()) as connection, connection:
        existing = connection.execute(
            "SELECT * FROM review_events WHERE review_id = ?",
            (record["review_id"],),
        ).fetchone()
        if existing:
            existing_record = _review_dict(existing)
            comparable = {key: existing_record[key] for key in record if key != "created_at"}
            if comparable != {key: value for key, value in record.items() if key != "created_at"}:
                raise HTTPException(status_code=409, detail="This review ID was already used for a different decision.")
            return existing_record, False
        connection.execute(
            """
            INSERT INTO review_events
                (review_id, incident_id, actor_name, role, decision, reason, changed_assessment, created_at, auth_method)
            VALUES
                (:review_id, :incident_id, :actor_name, :role, :decision, :reason, :changed_assessment, :created_at, :auth_method)
            """,
            record,
        )
    return record, True


def read_json(name: str):
    path = OUTPUT_DIR / name
    if not path.exists():
        raise HTTPException(status_code=503, detail="Data pipeline has not been run yet. Run `python -m app.run_pipeline` first.")
    return json.loads(path.read_text(encoding="utf-8"))


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


@app.get("/api/incidents")
def incidents(
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    user: DemoUser = Depends(require_authenticated_user),
):
    import pandas as pd
    path = OUTPUT_DIR / "incidents.csv"
    if not path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    df = pd.read_csv(path)
    if search:
        searchable = [column for column in ["incident_id", "facility_id", "severity", "direction"] if column in df]
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

    max_age = 8 * 60 * 60
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
    incidents_path = OUTPUT_DIR / "incidents.csv"
    if not incidents_path.exists():
        raise HTTPException(status_code=503, detail="Run the data pipeline first.")
    incidents_df = pd.read_csv(incidents_path, usecols=["incident_id"])
    if submission.incident_id not in set(incidents_df["incident_id"].astype(str)):
        raise HTTPException(status_code=404, detail="Incident not found")
    record, created = _record_review(submission, user)
    return {
        "status": "recorded" if created else "already_recorded",
        "review": record,
        "notice": "Reviewer identity is verified against a pre-provisioned demo account; this is prototype authentication, not production identity management.",
    }


@app.get("/api/reviews")
@app.get("/api/audit-log")
def review_audit_log(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: DemoUser = Depends(require_authenticated_user),
):
    with closing(_connect_audit_db()) as connection:
        total = connection.execute("SELECT COUNT(*) FROM review_events").fetchone()[0]
        rows = connection.execute(
            "SELECT * FROM review_events ORDER BY created_at DESC, review_id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    return {
        "items": [_review_dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "notice": "New audit events use pre-provisioned demo accounts. Older self-reported events remain marked as legacy. This is prototype authentication, not production identity management.",
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
