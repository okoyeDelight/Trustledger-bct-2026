"""ABBIS-like synthetic source replay through genuine connector endpoints.

Local test only; PostgreSQL permission tests use a disposable Neon branch. No
clinical suitability, real ABBIS connection or sensor provenance is claimed.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import main

def _make_event(index, facility="SYN-A", source="ABBIS sandbox fixture", temp=7.2, gap=0):
    timestamp=datetime(2026, 10, 1, 9, tzinfo=timezone.utc)+timedelta(hours=index+gap)
    return {
        "schema_version": "trustledger.observation.v1",
        "source_system": source,
        "source_event_id": f"TEMP-{facility}-{timestamp.strftime('%Y%m%d%H%M')}",
        "facility_id": facility,
        "observed_at": timestamp.isoformat(),
        "temperature_c": temp,
    }

@pytest.fixture
def adapter_env(tmp_path, monkeypatch):
    output = tmp_path / "processed"
    raw = tmp_path / "raw"
    output.mkdir()
    raw.mkdir()
    monkeypatch.setattr(main, "OUTPUT_DIR", output)
    monkeypatch.setattr(main, "RAW_DIR", raw)
    monkeypatch.setattr(main, "AUDIT_DB_PATH", output / "test.sqlite3")
    for key in ("DATABASE_URL","TRUSTLEDGER_REQUIRE_DATABASE","VERCEL"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("TRUSTLEDGER_AUTH_SECRET","test-auth-secret-is-long-enough-for-this-synthetic-case")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_USERNAME","feed_operator")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_PASSWORD","feed_operator_test_password_secure")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_NAME","Synthetic Feed Operator")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME","feed_supervisor")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD","feed_supervisor_test_password_secure")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_NAME","Synthetic Feed Supervisor")
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SECURE","false")
    monkeypatch.setenv("TRUSTLEDGER_CONNECTOR_API_KEY","test-connector-key-long-enough-to-be-valid-32-chars")
    return output, raw

def _login(client,role):
    username = "feed_operator" if role=="worker" else "feed_supervisor"
    password = "feed_operator_test_password_secure" if role=="worker" else "feed_supervisor_test_password_secure"
    response=client.post("/api/auth/login",json={"username":username,"password":password})
    assert response.status_code==200,response.text


def test_four_real_http_observations_create_case_and_return_review(adapter_env):
    with TestClient(main.app) as worker, TestClient(main.app) as supervisor, TestClient(main.app) as partner:
        assert partner.post("/api/connectors/v1/observations",json=_make_event(0)).status_code==401
        _login(worker,"worker")
        _login(supervisor,"reviewer")
        assert supervisor.post("/api/connectors/v1/observations",json=_make_event(0)).status_code==403

        for i in range(3):
            response=worker.post("/api/connectors/v1/observations",json=_make_event(i))
            assert response.status_code==201,response.text
            assert response.json()["observation_stored"] is True
            assert response.json()["case_reference"] is None

        created=worker.post("/api/connectors/v1/observations",json=_make_event(3))
        assert created.status_code==201,created.text
        assert created.json()["case_created"] is True
        reference=created.json()["case_reference"]
        assert reference.startswith("EXT-")
        detail=worker.get(f"/api/incidents/{reference}")
        assert detail.status_code==200,detail.text
        d=detail.json()["incident"]
        assert d["reading_count"]==4
        assert d["severity"]=="sustained"
        assert d["source_type"]=="external_observation"
        assert d["source_payload"]["episode_readings"][0]["temperature_c"]==7.2

        duplicate=worker.post("/api/connectors/v1/observations",json=_make_event(3))
        assert duplicate.status_code==200,duplicate.text
        assert duplicate.json()["status"]=="duplicate_acknowledged"
        assert duplicate.json()["case_reference"]==reference
        conflict=worker.post("/api/connectors/v1/observations",json={**_make_event(3),"temperature_c":8.1})
        assert conflict.status_code==409

        # The real partner API uses its own server-to-server API key.
        headers={"X-TrustLedger-Connector-Key":"test-connector-key-long-enough-to-be-valid-32-chars"}
        external=partner.get(f"/api/connectors/v1/cases/{reference}",headers=headers)
        assert external.status_code==200,external.text
        assert external.json()["investigation_status"]=="investigating"
        assert external.json()["clinical_clearance"] is None
        assert partner.get(f"/api/connectors/v1/cases/{reference}",headers={"X-TrustLedger-Connector-Key":"incorrect"}).status_code==401

        finding=worker.post(f"/api/incidents/{reference}/notes",json={"finding":"Four dated source observations checked; device identity and actual exposure remain unverified."})
        assert finding.status_code==201,finding.text
        submitted=worker.post(f"/api/incidents/{reference}/submit",json={
            "summary":"Synthetic four-hour streak requires independent evidence review; no clinical decision."
        })
        assert submitted.status_code==200,submitted.text
        review=supervisor.post("/api/reviews",json={
            "review_id":str(uuid4()),
            "incident_id":reference,
            "decision":"accept",
            "reason":"Investigation record accepted for synthetic follow-up, not product release.",
        })
        assert review.status_code==200,review.text
        after=partner.get(f"/api/connectors/v1/cases/{reference}",headers=headers)
        assert after.status_code==200,after.text
        assert after.json()["investigation_status"]=="followup"
        assert any(x["event_kind"]=="review_accepted" for x in after.json()["review_events"])
        assert after.json()["clinical_clearance"] is None

        # Replays after the fourth sample must not create an additional case.
        fifth=worker.post("/api/connectors/v1/observations",json=_make_event(4))
        assert fifth.status_code==201,fifth.text
        reports=main.workflow_store.list_staff_reports(main._connect_audit_db)
        assert len([x for x in reports if x["report_ref"].startswith("EXT-")])==1


def test_missing_hour_or_intervening_normal_breaks_streak(adapter_env):
    with TestClient(main.app) as worker:
        _login(worker,"worker")
        events=[_make_event(0,facility="SYN-GAP"),_make_event(1,facility="SYN-GAP"),
                _make_event(2,facility="SYN-GAP",gap=1),_make_event(3,facility="SYN-GAP",gap=1)]
        for e in events:
            assert worker.post("/api/connectors/v1/observations",json=e).json()["case_reference"] is None
        normal=_make_event(4,facility="SYN-GAP",gap=1,temp=4.0)
        assert worker.post("/api/connectors/v1/observations",json=normal).json()["case_reference"] is None
        assert worker.post("/api/connectors/v1/observations",json={
            **_make_event(6,facility="SYN-GAP"),"temperature_c":99.9
        }).status_code==422


def test_sandbox_selects_real_rows_from_pinned_input(adapter_env):
    processed, raw=adapter_env
    pd.DataFrame([{
        "incident_id":"INC-SYN-1","facility_id":"SYN-REAL","severity":"sustained",
        "start_time":"2026-10-01 09:00:00","end_time":"2026-10-01 13:00:00"
    }]).to_csv(processed/"incidents.csv",index=False)
    pd.DataFrame([{
        "facility_id":"SYN-REAL",
        "recorded_at":f"2026-10-01 {hour:02}:00:00",
        "temp_c":6.8+0.1*(hour-9),
    } for hour in range(9,13)]).to_csv(raw/"temperature_logs.csv",index=False)
    with TestClient(main.app) as worker:
        _login(worker,"worker")
        sample=worker.get("/api/integrations/sandbox/sample")
        assert sample.status_code==200,sample.text
        assert len(sample.json()["items"])==4
        assert sample.json()["items"][0]["temperature_c"]==6.8
        assert all(e["observed_at"].endswith("+00:00") for e in sample.json()["items"])
        assert "timezone" in sample.json()["timestamp_note"]
