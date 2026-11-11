"""One case, two distinct demo identities, append-only event history.

Synthetic only. No clinical release or blood component disposition.
"""
import sqlite3
from datetime import datetime, timezone
from uuid import UUID

import pandas as pd
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app import main


OPERATOR = main.DemoUser(username="synthetic-worker", actor_name="Worker Test", role="facility_staff")
SUPERVISOR = main.DemoUser(
    username="synthetic-supervisor", actor_name="Supervisor Test", role="blood_service_supervisor"
)


@pytest.fixture
def case_env(tmp_path, monkeypatch):
    output = tmp_path / "processed"
    output.mkdir()
    pd.DataFrame([{
        "incident_id": "INC-1",
        "facility_id": "HSP-024",
        "start_time": "2026-10-01 09:00:00",
        "end_time": "2026-10-01 11:00:00",
    }]).to_csv(output / "incidents.csv", index=False)
    monkeypatch.setattr(main, "OUTPUT_DIR", output)
    monkeypatch.setattr(main, "AUDIT_DB_PATH", output / "audit.sqlite3")
    for key in ("DATABASE_URL", "VERCEL", "TRUSTLEDGER_REQUIRE_DATABASE"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("TRUSTLEDGER_AUTH_SECRET", "test-secret-with-at-least-thirty-two-characters")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_USERNAME", OPERATOR.username)
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_PASSWORD", "synthetic-operator-long-password")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_NAME", OPERATOR.actor_name)
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME", SUPERVISOR.username)
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD", "synthetic-reviewer-long-password")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_NAME", SUPERVISOR.actor_name)
    return output


def finding(case="INC-1", text="Original synthetic log checked; device location has not been verified."):
    return main.InvestigationNoteRequest(finding=text)


def review(decision="accept", reason="Reviewed synthetic evidence and requested documented follow-up.",
           changed_assessment=None, reference="INC-1"):
    return main.ReviewSubmission(
        review_id="2472f8b0-84c6-4e9e-8c82-6970a22451da",
        incident_id=reference, decision=decision, reason=reason,
        changed_assessment=changed_assessment,
    )


def submit():
    return main.submit_investigation(
        "INC-1",
        main.InvestigationSubmissionRequest(summary="Missing device-level evidence; request independent review."),
        OPERATOR,
    )


def test_case_requires_investigation_before_supervisor_review(case_env):
    with pytest.raises(HTTPException) as missing:
        submit()
    assert missing.value.status_code == 409
    with pytest.raises(HTTPException) as premature:
        main.create_review(review(), SUPERVISOR)
    assert premature.value.status_code == 409

    main.add_incident_note("INC-1", finding(), OPERATOR)
    queued = submit()
    assert queued["status"] == "awaiting_review"
    assert queued["submitted_by"] == OPERATOR.username
    assert main.review_queue(SUPERVISOR)["items"][0]["case_reference"] == "INC-1"

    with pytest.raises(HTTPException) as role:
        main.review_queue(OPERATOR)
    assert role.value.status_code == 403
    with pytest.raises(HTTPException) as locked:
        main.add_incident_note("INC-1", finding(text="Worker cannot modify a submitted investigation."), OPERATOR)
    assert locked.value.status_code == 409
    with pytest.raises(HTTPException) as double_submit:
        submit()
    assert double_submit.value.status_code == 409


def test_review_followup_completion_and_administrative_closure(case_env):
    main.add_incident_note("INC-1", finding(), OPERATOR)
    submit()
    accepted = main.create_review(review(), SUPERVISOR)
    assert accepted["status"] == "recorded"
    assert main.create_review(review(), SUPERVISOR)["status"] == "already_recorded"
    assert main.incident_workflow("INC-1", SUPERVISOR)["status"] == "followup"
    assert main.review_queue(SUPERVISOR)["items"] == []

    with pytest.raises(HTTPException) as wrong_role:
        main.create_followup("INC-1", main.FollowupRequest(
            description="Inspect the synthetic logger wiring and report results."
        ), OPERATOR)
    assert wrong_role.value.status_code == 403

    state = main.create_followup(
        "INC-1",
        main.FollowupRequest(description="Check the synthetic logger calibration and document findings."),
        SUPERVISOR,
    )
    action = state["followups"][0]
    assert action["owner_username"] == OPERATOR.username
    assert action["status"] == "open"
    with pytest.raises(HTTPException) as premature_close:
        main.close_incident("INC-1", main.ClosureRequest(
            reason="Administrative processing complete, not a clinical disposition."
        ), SUPERVISOR)
    assert premature_close.value.status_code == 409

    completed = main.complete_followup(
        "INC-1", UUID(action["action_id"]),
        main.CompleteFollowupRequest(
            completion_note="Synthetic source checked; uncertain device attribution recorded."
        ), OPERATOR,
    )
    assert completed["followups"][0]["status"] == "done"
    with pytest.raises(HTTPException) as repeated:
        main.complete_followup(
            "INC-1", UUID(action["action_id"]),
            main.CompleteFollowupRequest(completion_note="This should not append twice."),
            OPERATOR,
        )
    assert repeated.value.status_code == 409

    closed = main.close_incident(
        "INC-1", main.ClosureRequest(
            reason="Investigation administratively closed; blood safety remains unassessed."
        ), SUPERVISOR,
    )
    assert closed["status"] == "closed"
    assert closed["events"][-1]["details"]["scope"] == "administrative_only_not_clinical_clearance"
    assert main.incident_workflow("INC-1", OPERATOR)["status"] == "closed"
    case_history = main.case_history(50, 0, OPERATOR)
    assert case_history["total"] == 5
    assert case_history["items"][0]["event_kind"] == "case_closed"
    assert case_history["items"][-1]["event_kind"] == "investigation_submitted"
    with sqlite3.connect(main.AUDIT_DB_PATH) as conn:
        with pytest.raises(sqlite3.IntegrityError, match="append-only"):
            conn.execute("DELETE FROM case_events WHERE case_reference='INC-1'")


def test_returned_case_requires_new_evidence_before_resubmitting(case_env):
    main.add_incident_note("INC-1", finding(), OPERATOR)
    submit()
    changed = review(
        decision="change",
        changed_assessment="Please check the original logger clock and missing-hour assumptions.",
    )
    main.create_review(changed, SUPERVISOR)
    assert main.incident_workflow("INC-1", OPERATOR)["status"] == "returned"
    with pytest.raises(HTTPException) as stale:
        submit()
    assert stale.value.status_code == 409
    main.add_incident_note("INC-1", finding(
        text="Checked the synthetic logger clock; gaps remain unverified until source confirmation."
    ), OPERATOR)
    assert submit()["status"] == "awaiting_review"
    assert len(main.review_queue(SUPERVISOR)["items"]) == 1


def test_reported_case_enters_same_workflow_without_fabricated_readings(case_env):
    report = main.StaffReportRequest(
        facility_code="HSP-024", category="equipment_problem",
        title="Synthetic cold room door not sealing",
        description="Staff noticed a gap near the gasket; no logger row confirms the cause.",
        observed_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
    )
    case = main.report_incident(report, OPERATOR)["incident"]
    assert case["peak_temp_c"] is None
    main.add_incident_note(case["incident_id"], finding(case["incident_id"]), OPERATOR)
    response = main.submit_investigation(
        case["incident_id"],
        main.InvestigationSubmissionRequest(
            summary="Worker observed possible gasket failure but no validated sensor match."
        ), OPERATOR,
    )
    assert response["status"] == "awaiting_review"
    assert main.incident_detail(case["incident_id"], SUPERVISOR)["temperature_history"] == []


def test_bad_input_rejected_and_missing_case_does_not_write_events(case_env):
    with pytest.raises(ValidationError):
        main.FollowupRequest(description="Too short")
    with pytest.raises(ValidationError):
        main.StaffReportRequest(
            facility_code="HSP-024", category="other", title="A valid title",
            description="A valid test description",
            observed_at="2026-10-01T11:00:00",
        )
    with pytest.raises(HTTPException) as missing:
        main.submit_investigation(
            "INC-DOES-NOT-EXIST",
            main.InvestigationSubmissionRequest(summary="Cannot submit an unknown source incident."),
            OPERATOR,
        )
    assert missing.value.status_code == 404
