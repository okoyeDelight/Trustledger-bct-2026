"""Two separate HTTP sessions must share one synthetic case and never share permissions.

Uses randomly generated, process-local demo credentials; the fixtures cannot leak
as commits, Vercel variables or test logs. SQLite is an isolated local stand-in;
a separate Neon branch test validates real database permissions.
"""
import secrets
from datetime import datetime, timezone
from uuid import uuid4

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture()
def identities(tmp_path, monkeypatch):
    output=tmp_path/"processed"
    output.mkdir()
    pd.DataFrame([{
        "incident_id":"INC-E2E-1",
        "facility_id":"HSP-024",
        "start_time":"2026-10-01 09:00:00",
        "end_time":"2026-10-01 10:00:00",
        "duration_hours":1,
        "reading_count":2,
        "peak_temp_c":7.1,
        "minimum_temp_c":6.2,
        "direction":"above",
        "severity":"warning",
        "sustained_rule":"Illustrative synthetic case only",
    }]).to_csv(output/"incidents.csv",index=False)
    monkeypatch.setattr(main,"OUTPUT_DIR",output)
    monkeypatch.setattr(main,"AUDIT_DB_PATH",output/"test_audit.sqlite3")
    for k in ("DATABASE_URL","VERCEL","TRUSTLEDGER_REQUIRE_DATABASE"):
        monkeypatch.delenv(k,raising=False)
    credentials={
        "worker":("worker_e2e",secrets.token_urlsafe(36)),
        "reviewer":("reviewer_e2e",secrets.token_urlsafe(36)),
    }
    monkeypatch.setenv("TRUSTLEDGER_AUTH_SECRET",secrets.token_urlsafe(48))
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SECURE","false")
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SAMESITE","lax")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_USERNAME",credentials["worker"][0])
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_PASSWORD",credentials["worker"][1])
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_NAME","Synthetic Facility Worker")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME",credentials["reviewer"][0])
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD",credentials["reviewer"][1])
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_NAME","Synthetic Quality Reviewer")
    return credentials


def _login(client,username,password,role):
    response=client.post("/api/auth/login",json={"username":username,"password":password})
    assert response.status_code==200,response.text
    assert response.json()["user"]["role"]==role
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "path=/api" in response.headers["set-cookie"].lower()
    return response


def test_two_account_http_journey_with_separation_and_shared_history(identities):
    with TestClient(main.app) as worker, TestClient(main.app) as reviewer, TestClient(main.app) as stranger:
        assert stranger.get("/api/auth/me").status_code==401
        assert worker.post("/api/auth/login",json={
            "username":identities["worker"][0],"password":"incorrect_test_password"
        }).status_code==401

        _login(worker,*identities["worker"],"facility_staff")
        _login(reviewer,*identities["reviewer"],"blood_service_supervisor")
        assert worker.get("/api/auth/me").json()["role"]=="facility_staff"
        assert reviewer.get("/api/auth/me").json()["role"]=="blood_service_supervisor"
        assert worker.get("/api/review-queue").status_code==403
        assert reviewer.get("/api/review-queue").json()["items"]==[]

        report=worker.post("/api/incidents/report",json={
            "facility_code":"HSP-024",
            "category":"equipment_problem",
            "title":"Synthetic cold room door seal issue",
            "description":"Worker observed a loose gasket, but has no verified device association.",
            "observed_at":datetime(2026,10,1,11,tzinfo=timezone.utc).isoformat(),
        })
        assert report.status_code==201,report.text
        reference=report.json()["incident"]["incident_id"]
        assert reference.startswith("REP-")
        assert reviewer.post("/api/incidents/report",json={
            "facility_code":"HSP-024","category":"other","title":"Supervisor forged report",
            "description":"Unauthorized supervisor role cannot write staff observations.",
            "observed_at":"2026-10-01T11:00:00Z"
        }).status_code==403

        # Shared persistence after a completely separate HTTP client requests the queue.
        q=reviewer.get("/api/incidents?limit=10")
        assert q.status_code==200
        assert reference in [r["incident_id"] for r in q.json()["items"]]
        assert stranger.get(f"/api/incidents/{reference}/workflow").status_code==401
        assert worker.get(f"/api/incidents/{reference}").json()["temperature_history"]==[]

        review_payload={
            "review_id":str(uuid4()),
            "incident_id":reference,
            "decision":"accept",
            "reason":"Retain investigation flag pending verification of synthetic source evidence.",
        }
        assert reviewer.post("/api/reviews",json=review_payload).status_code==409
        assert reviewer.post(f"/api/incidents/{reference}/notes",json={
            "finding":"Supervisor cannot impersonate a facility worker's observation."
        }).status_code==403
        note=worker.post(f"/api/incidents/{reference}/notes",json={
            "finding":"Checked the synthetic logger records and found no device-level association."
        })
        assert note.status_code==201,note.text
        assert reviewer.get(f"/api/incidents/{reference}/notes").json()["items"][0]["actor_role"]=="facility_staff"
        assert reviewer.post(f"/api/incidents/{reference}/submit",json={
            "summary":"A supervisor is not authorized to submit as the worker."
        }).status_code==403
        submitted=worker.post(f"/api/incidents/{reference}/submit",json={
            "summary":"Synthetic facility observations require a separate quality assessment."
        })
        assert submitted.status_code==200,submitted.text
        assert submitted.json()["status"]=="awaiting_review"
        assert worker.post("/api/reviews",json=review_payload).status_code==403
        assert worker.post(f"/api/incidents/{reference}/notes",json={
            "finding":"An already submitted investigation must be locked."
        }).status_code==409

        queue=reviewer.get("/api/review-queue")
        assert reference in [x["case_reference"] for x in queue.json()["items"]]
        reviewed=reviewer.post("/api/reviews",json=review_payload)
        assert reviewed.status_code==200,reviewed.text
        assert reviewed.json()["status"]=="recorded"
        assert reviewer.post("/api/reviews",json=review_payload).json()["status"]=="already_recorded"
        assert reviewer.get("/api/review-queue").json()["items"]==[]

        created=reviewer.post(f"/api/incidents/{reference}/followups",json={
            "description":"Inspect synthetic sensor clock and record a corroborating observation.",
            "due_at":"2026-12-01T09:00:00+03:00",
        })
        assert created.status_code==201,created.text
        followup=created.json()["followups"][0]
        assert followup["owner_username"]==identities["worker"][0]
        action_id=followup["action_id"]
        assert worker.post(f"/api/incidents/{reference}/close",json={
            "reason":"Worker cannot administratively close a reviewed case."
        }).status_code==403
        assert reviewer.post(f"/api/incidents/{reference}/close",json={
            "reason":"Cannot close until the assigned follow-up has been completed."
        }).status_code==409

        completed=worker.post(f"/api/incidents/{reference}/followups/{action_id}/complete",json={
            "completion_note":"Synthetic source clock inspected; unknown fridge mapping explicitly recorded."
        })
        assert completed.status_code==200,completed.text
        assert completed.json()["followups"][0]["status"]=="done"
        closed=reviewer.post(f"/api/incidents/{reference}/close",json={
            "reason":"Administrative case work finished, no clinical safety decision made."
        })
        assert closed.status_code==200,closed.text
        assert closed.json()["status"]=="closed"
        assert worker.get(f"/api/incidents/{reference}/workflow").json()["status"]=="closed"

        assert stranger.get("/api/case-history").status_code==401
        history=worker.get("/api/case-history")
        assert history.status_code==200
        kinds=[x["event_kind"] for x in history.json()["items"]]
        assert "investigation_submitted" in kinds
        assert "review_accepted" in kinds
        assert "followup_created" in kinds
        assert "followup_completed" in kinds
        assert "case_closed" in kinds
        assert all(x["case_reference"]==reference for x in history.json()["items"])
        assert reviewer.get("/api/audit-log").json()["total"]==1

        logout=worker.post("/api/auth/logout")
        assert logout.status_code==200
        assert worker.get("/api/auth/me").status_code==401
        assert reviewer.get("/api/auth/me").status_code==200


def test_tampered_session_and_reused_demo_password_are_not_accepted(identities,monkeypatch):
    with TestClient(main.app) as worker:
        _login(worker,*identities["worker"],"facility_staff")
        cookie=worker.cookies.get("trustledger_session")
        assert cookie
        worker.cookies.set("trustledger_session",cookie[:-1]+("a" if cookie[-1]!="a" else "b"),path="/api")
        assert worker.get("/api/auth/me").status_code==401

    # Prevent accidental re-use of one leaked/weak shared password for two roles.
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD",identities["worker"][1])
    with TestClient(main.app) as worker:
        response=worker.post("/api/auth/login",json={
            "username":identities["worker"][0],"password":identities["worker"][1]
        })
        assert response.status_code==503


def test_external_observation_becomes_real_case_and_returns_human_status(identities):
    sample = {
        "schema_version": "trustledger.observation.v1",
        "source_system": "Simulated ABBIS connector",
        "source_event_id": "SYN-ABBIS-ALERT-001",
        "facility_id": "SYN-HOSP-01",
        "observed_at": "2026-10-01T09:00:00+01:00",
        "temperature_c": 7.2,
    }
    with TestClient(main.app) as worker, TestClient(main.app) as supervisor, TestClient(main.app) as guest:
        assert guest.post("/api/integrations/demo/observations", json=sample).status_code == 401
        _login(worker, *identities["worker"], "facility_staff")
        _login(supervisor, *identities["reviewer"], "blood_service_supervisor")
        assert supervisor.post("/api/integrations/demo/observations", json=sample).status_code == 403
        bad = {k: v for k, v in sample.items() if k != "observed_at"}
        assert worker.post("/api/integrations/demo/observations", json=bad).status_code == 422

        warning = {**sample, "temperature_c": 99.9}
        assert worker.post("/api/integrations/demo/observations", json=warning).status_code == 422
        normal = {**sample, "source_event_id": "SYN-NORMAL-002", "temperature_c": 4.0}
        accepted_normal = worker.post("/api/integrations/demo/observations", json=normal)
        assert accepted_normal.status_code == 200
        assert accepted_normal.json()["status"] == "in_range_not_recorded"
        assert accepted_normal.json()["persisted"] is False

        response = worker.post("/api/integrations/demo/observations", json=sample)
        assert response.status_code == 201, response.text
        assert response.json()["status"] == "incident_created"
        reference = response.json()["case_reference"]
        assert reference.startswith("EXT-")
        assert response.json()["incident"]["source_type"] == "external_observation"
        assert response.json()["incident"]["peak_temp_c"] == 7.2

        repeated = worker.post("/api/integrations/demo/observations", json=sample)
        assert repeated.status_code == 200, repeated.text
        assert repeated.json()["case_reference"] == reference
        assert repeated.json()["status"] == "already_imported"

        conflict = worker.post(
            "/api/integrations/demo/observations",
            json={**sample, "temperature_c": 8.7},
        )
        assert conflict.status_code == 409
        incidents = supervisor.get("/api/incidents?limit=100")
        assert incidents.status_code == 200
        assert sum(i["incident_id"] == reference for i in incidents.json()["items"]) == 1
        detail = worker.get(f"/api/incidents/{reference}")
        assert detail.status_code == 200
        assert detail.json()["temperature_history"] == []
        assert detail.json()["incident"]["source_payload"]["source_event_id"] == sample["source_event_id"]
        assert detail.json()["potentially_affected_units"] == []

        initial = supervisor.get(f"/api/integrations/demo/cases/{reference}")
        assert initial.status_code == 200
        assert initial.json()["investigation_status"] == "investigating"
        assert initial.json()["clinical_clearance"] is None
        assert guest.get(f"/api/integrations/demo/cases/{reference}").status_code == 401

        note = worker.post(f"/api/incidents/{reference}/notes", json={
            "finding": "Single synthetic external reading checked; no device identity or exposure is confirmed."
        })
        assert note.status_code == 201, note.text
        submit = worker.post(f"/api/incidents/{reference}/submit", json={
            "summary": "The candidate requires independent review; device and duration remain unknown."
        })
        assert submit.status_code == 200, submit.text
        queued = supervisor.get("/api/review-queue")
        assert reference in [x["case_reference"] for x in queued.json()["items"]]
        decision = supervisor.post("/api/reviews", json={
            "review_id": str(uuid4()),
            "incident_id": reference,
            "decision": "accept",
            "reason": "Synthetic record accepted for administrative follow-up only."
        })
        assert decision.status_code == 200, decision.text
        final = supervisor.get(f"/api/integrations/demo/cases/{reference}")
        assert final.status_code == 200
        assert final.json()["investigation_status"] == "followup"
        assert any(e["event_kind"] == "review_accepted" for e in final.json()["review_events"])
        assert final.json()["clinical_clearance"] is None
