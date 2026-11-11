"""The independent ABBIS source must create a real TrustLedger workflow case.

Four historical synthetic observations are sent over a scoped connector. This
test does not simulate clinical release and never contacts a real blood bank.
"""
import secrets
from uuid import uuid4

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture()
def configured(tmp_path, monkeypatch):
    output = tmp_path / "processed"
    output.mkdir()
    # Historical file exists as evaluation material, but NOT in the live queue.
    pd.DataFrame([{
        "incident_id": "INC-HISTORICAL-ONLY", "facility_id": "HSP-028",
        "start_time": "2025-11-01 00:00:00", "end_time": "2025-11-01 01:00:00",
        "severity": "warning", "direction": "above_range",
    }]).to_csv(output / "incidents.csv", index=False)
    monkeypatch.setattr(main, "OUTPUT_DIR", output)
    monkeypatch.setattr(main, "AUDIT_DB_PATH", output / "test_api.sqlite3")
    for name in ("DATABASE_URL", "VERCEL", "TRUSTLEDGER_REQUIRE_DATABASE"):
        monkeypatch.delenv(name, raising=False)
    worker_password = secrets.token_urlsafe(32)
    supervisor_password = secrets.token_urlsafe(32)
    monkeypatch.setenv("TRUSTLEDGER_AUTH_SECRET", secrets.token_urlsafe(48))
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_USERNAME", "synthetic_worker")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_PASSWORD", worker_password)
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_NAME", "Synthetic Worker")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME", "synthetic_supervisor")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD", supervisor_password)
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_NAME", "Synthetic Supervisor")
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SECURE", "false")
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SAMESITE", "lax")
    return worker_password, supervisor_password


def test_source_only_ingestion_to_worker_supervisor_and_status(configured):
    worker_password, supervisor_password = configured
    with (
        TestClient(main.app) as worker,
        TestClient(main.app) as supervisor,
        TestClient(main.app) as source,
    ):
        assert worker.post("/api/auth/login", json={
            "username": "synthetic_worker", "password": worker_password,
        }).status_code == 200
        assert supervisor.post("/api/auth/login", json={
            "username": "synthetic_supervisor", "password": supervisor_password,
        }).status_code == 200

        active = worker.get("/api/incidents?view=active")
        assert active.status_code == 200, active.text
        assert active.json()["total"] == 0
        historical = worker.get("/api/incidents?view=historical")
        assert historical.status_code == 200
        assert historical.json()["total"] == 1

        assert worker.post("/api/connections", json={
            "label": "Synthetic ABBIS source",
            "source_system": "ABBIS-SANDBOX", "facility_code": "HSP-028",
        }).status_code == 403
        connected = supervisor.post("/api/connections", json={
            "label": "Synthetic ABBIS source",
            "source_system": "ABBIS-SANDBOX", "facility_code": "HSP-028",
        })
        assert connected.status_code == 201, connected.text
        key = connected.json()["key"]
        headers = {"X-TrustLedger-Connector-Key": key}
        assert source.get("/api/connectors/v1/connection", headers=headers).json()["connected"]
        assert source.get("/api/connectors/v1/cases", headers=headers).json()["items"] == []

        case_ref = None
        for i, temp in enumerate((7.4, 8.2, 9.1, 10.1)):
            payload = {
                "schema_version": "trustledger.observation.v1",
                "source_system": "ABBIS-SANDBOX",
                "source_event_id": f"SRC-HSP-028-202511010{i}00",
                "facility_id": "HSP-028",
                "observed_at": f"2025-11-01T0{i}:00:00+00:00",
                "temperature_c": temp,
            }
            receipt = source.post("/api/connectors/v1/observations",
                                  headers=headers, json=payload)
            assert receipt.status_code == 201, receipt.text
            assert receipt.json()["observation_stored"] is True
            if i < 3:
                assert receipt.json()["case_created"] is False
                assert worker.get("/api/incidents?view=active").json()["total"] == 0
            else:
                assert receipt.json()["case_created"] is True
                case_ref = receipt.json()["case_reference"]
                assert case_ref.startswith("EXT-")
                # Repeat the fourth observation: ACK is idempotent and no new case.
                repeat = source.post("/api/connectors/v1/observations",
                                     headers=headers, json=payload)
                assert repeat.status_code == 200, repeat.text
                assert repeat.json()["status"] == "duplicate_acknowledged"
                changed = source.post("/api/connectors/v1/observations",
                                      headers=headers, json={**payload, "temperature_c": 15})
                assert changed.status_code == 409
        assert case_ref
        live = worker.get("/api/incidents?view=active").json()
        assert live["total"] == 1
        assert live["items"][0]["incident_id"] == case_ref
        assert worker.get(f"/api/incidents/{case_ref}").status_code == 200

        note = worker.post(f"/api/incidents/{case_ref}/notes", json={
            "finding": "Synthetic source readings were received; individual unit exposure is not established.",
        })
        assert note.status_code == 201, note.text
        submitted = worker.post(f"/api/incidents/{case_ref}/submit", json={
            "summary": "Four consecutive historical source observations warrant human investigation only.",
        })
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["status"] == "awaiting_review"

        assert worker.post("/api/reviews", json={
            "review_id": str(uuid4()), "incident_id": case_ref,
            "decision": "accept", "reason": "Worker cannot approve own case.",
        }).status_code == 403
        review = supervisor.post("/api/reviews", json={
            "review_id": str(uuid4()), "incident_id": case_ref,
            "decision": "accept",
            "reason": "Investigation flag accepted; source evidence remains unverified clinically.",
        })
        assert review.status_code == 200, review.text

        status = source.get(f"/api/connectors/v1/cases/{case_ref}", headers=headers)
        assert status.status_code == 200, status.text
        assert status.json()["investigation_status"] == "followup"
        assert any(e["event_kind"] == "review_accepted" for e in status.json()["review_events"])
        assert status.json()["clinical_clearance"] is None
        assert case_ref in [
            item["case_reference"]
            for item in source.get("/api/connectors/v1/cases", headers=headers).json()["items"]
        ]
