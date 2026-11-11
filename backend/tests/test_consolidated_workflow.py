"""Regression tests for the consolidated synthetic-only worker to reviewer workflow."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest
from fastapi import HTTPException

from app import main


OPERATOR = main.DemoUser(username="op-test", actor_name="Synthetic Worker", role="facility_staff")
SUPERVISOR = main.DemoUser(username="review-test", actor_name="Synthetic Reviewer", role="blood_service_supervisor")


@pytest.fixture
def storage(tmp_path, monkeypatch):
    output=tmp_path/"processed"
    output.mkdir()
    pd.DataFrame([{
        "incident_id":"INC-00001", "facility_id":"HSP-024",
        "start_time":"2026-09-30 09:00:00","end_time":"2026-09-30 10:00:00",
        "duration_hours":1,"reading_count":2,"peak_temp_c":7.0,
        "minimum_temp_c":6.2,"direction":"above","severity":"warning",
        "sustained_rule":"Synthetic illustration",
    }]).to_csv(output/"incidents.csv",index=False)
    monkeypatch.setattr(main,"OUTPUT_DIR",output)
    monkeypatch.setattr(main,"AUDIT_DB_PATH",output/"audit.sqlite3")
    for key in ("DATABASE_URL","VERCEL","TRUSTLEDGER_REQUIRE_DATABASE"):
        monkeypatch.delenv(key,raising=False)
    return output


def test_staff_report_appears_in_same_incident_queue(storage):
    payload=main.StaffReportRequest(
        facility_code="HSP-024", category="equipment_problem",
        title="Cold room door seal failed",
        description="Worker observed a loose gasket, temperature remains unverified.",
        observed_at=datetime(2026,9,30,11,tzinfo=timezone.utc),
    )
    saved=main.report_incident(payload,OPERATOR)["incident"]
    assert saved["incident_id"].startswith("REP-")
    assert saved["source_type"]=="staff_report"
    queue=main.incidents(50,0,None,OPERATOR)
    assert queue["total"]==2
    assert {item["incident_id"] for item in queue["items"]}=={"INC-00001",saved["incident_id"]}
    detail=main.incident_detail(saved["incident_id"],OPERATOR)
    assert detail["temperature_history"]==[]
    assert "Staff-reported" in detail["notice"]
    with pytest.raises(HTTPException) as error:
        main.report_incident(payload,SUPERVISOR)
    assert error.value.status_code==403


def test_worker_note_and_independent_supervisor_review_are_stored(storage):
    note=main.add_incident_note(
        "INC-00001",main.InvestigationNoteRequest(finding="Source temperatures checked; fridge identity is unknown."),
        OPERATOR,
    )
    assert note["note"]["actor_role"]=="facility_staff"
    assert len(main.incident_notes("INC-00001",SUPERVISOR)["items"])==1
    with pytest.raises(HTTPException) as error:
        main.add_incident_note("INC-00001",main.InvestigationNoteRequest(finding="Supervisor note blocked."),SUPERVISOR)
    assert error.value.status_code==403

    review=main.ReviewSubmission(
        review_id="00000000-0000-4000-8000-000000000051",incident_id="INC-00001",
        decision="accept",reason="Retain flag pending review of monitoring evidence",
    )
    with pytest.raises(HTTPException) as error:
        main.create_review(review,OPERATOR)
    assert error.value.status_code==403
    with pytest.raises(HTTPException) as pending:
        main.create_review(review,SUPERVISOR)
    assert pending.value.status_code == 409
    submitted=main.submit_investigation(
        "INC-00001",
        main.InvestigationSubmissionRequest(summary="Synthetic readings investigated; please assess the gap."),
        OPERATOR,
    )
    assert submitted["status"] == "awaiting_review"
    result=main.create_review(review,SUPERVISOR)
    assert result["status"]=="recorded"
    assert main.create_review(review,SUPERVISOR)["status"]=="already_recorded"
    history=main.review_audit_log(10,0,SUPERVISOR)
    assert history["total"]==1
    assert history["items"][0]["role"]=="blood_service_supervisor"
    with sqlite3.connect(main.AUDIT_DB_PATH) as conn:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("UPDATE review_events SET reason='tampered'")


def test_no_spurious_authorization_when_database_missing_on_host(storage,monkeypatch):
    monkeypatch.setenv("VERCEL","1")
    with pytest.raises(HTTPException) as error:
        main.incidents(10,0,None,OPERATOR)
    assert error.value.status_code==503
    with pytest.raises(HTTPException) as error:
        main.create_review(main.ReviewSubmission(
            review_id="00000000-0000-4000-8000-000000000052",incident_id="INC-00001",
            decision="reject",reason="No valid evidence was available",
        ),SUPERVISOR)
    assert error.value.status_code==503
