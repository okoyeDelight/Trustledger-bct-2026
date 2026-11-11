import sqlite3
import sys
from pathlib import Path

import pandas as pd
import pytest
from fastapi import HTTPException, Response
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import main

REVIEWER = main.DemoUser(
    username="facility-demo",
    actor_name="Amina Reviewer",
    role="facility_staff",
)


@pytest.fixture
def review_environment(tmp_path, monkeypatch):
    output_dir = tmp_path / "processed"
    output_dir.mkdir()
    pd.DataFrame([{"incident_id": "INC-00001"}]).to_csv(
        output_dir / "incidents.csv", index=False
    )
    monkeypatch.setattr(main, "OUTPUT_DIR", output_dir)
    monkeypatch.setattr(main, "AUDIT_DB_PATH", output_dir / "review_audit.sqlite3")
    monkeypatch.setenv("TRUSTLEDGER_AUTH_SECRET", "test-secret-with-at-least-thirty-two-characters")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_USERNAME", "facility-demo")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_PASSWORD", "facility-password-long")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_NAME", "Amina Reviewer")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME", "supervisor-demo")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD", "supervisor-password-long")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_NAME", "Supervisor Reviewer")


def review_payload(**changes):
    payload = {
        "review_id": "0dd4f739-858e-4501-8b5a-fbc4ec5b54e4",
        "incident_id": "INC-00001",
        "decision": "change",
        "reason": "The sensor record needs a second check.",
        "changed_assessment": "Confirm the fridge log before escalating.",
    }
    return {**payload, **changes}


def test_review_is_persisted_and_returned_in_audit_log(review_environment):
    response = main.create_review(main.ReviewSubmission(**review_payload()), REVIEWER)
    assert response["status"] == "recorded"

    audit = main.review_audit_log(100, 0, REVIEWER)
    assert audit["total"] == 1
    assert audit["items"][0]["decision"] == "change"
    assert audit["items"][0]["actor_name"] == "Amina Reviewer"
    assert audit["items"][0]["auth_method"] == "preprovisioned_demo_account"
    assert audit["items"][0]["changed_assessment"] == "Confirm the fridge log before escalating."
    assert "pre-provisioned demo account" in audit["notice"]


def test_review_ids_are_idempotent_and_cannot_be_reused_for_another_decision(review_environment):
    payload = review_payload()
    assert main.create_review(main.ReviewSubmission(**payload), REVIEWER)["status"] == "recorded"
    assert main.create_review(main.ReviewSubmission(**payload), REVIEWER)["status"] == "already_recorded"
    conflicting = main.ReviewSubmission(
        **review_payload(decision="reject", changed_assessment=None)
    )
    with pytest.raises(HTTPException) as error:
        main.create_review(conflicting, REVIEWER)
    assert error.value.status_code == 409
    assert main.review_audit_log(100, 0, REVIEWER)["total"] == 1


def test_review_cannot_make_product_disposition_decisions():
    with pytest.raises(ValidationError):
        main.ReviewSubmission(**review_payload(decision="release"))


def test_review_does_not_accept_client_supplied_actor_or_role(review_environment):
    with pytest.raises(ValidationError):
        main.ReviewSubmission(**review_payload(actor_name="Forged Name"))


def test_review_requires_an_assessment_for_change():
    with pytest.raises(ValidationError):
        main.ReviewSubmission(**review_payload(changed_assessment=None))


def test_review_requires_non_whitespace_reason():
    with pytest.raises(ValidationError):
        main.ReviewSubmission(**review_payload(reason="     "))


def test_unknown_incident_cannot_be_reviewed(review_environment):
    submission = main.ReviewSubmission(**review_payload(incident_id="INC-404"))
    with pytest.raises(HTTPException) as error:
        main.create_review(submission, REVIEWER)
    assert error.value.status_code == 404


def test_audit_events_are_append_only(review_environment):
    main.create_review(main.ReviewSubmission(**review_payload()), REVIEWER)
    with pytest.raises(sqlite3.IntegrityError, match="append-only"):
        with sqlite3.connect(main.AUDIT_DB_PATH) as connection:
            connection.execute(
                "UPDATE review_events SET reason = 'changed' WHERE review_id = ?",
                ("0dd4f739-858e-4501-8b5a-fbc4ec5b54e4",),
            )


def test_baseline_candidate_view_returns_candidates_without_evaluation_labels(
    review_environment,
):
    baseline = pd.DataFrame([
        {
            "incident_id": "INC-00001",
            "unit_id": "UNIT-1",
            "facility_id": "FAC-1",
            "exposure_start": "2026-01-01 01:00:00",
            "exposure_end": "2026-01-01 02:00:00",
            "component": "RBC",
            "blood_group": "O+",
            "unit_status": "in_stock",
            "temp_excursion_exposed_label": True,
        }
    ])
    baseline.to_csv(main.OUTPUT_DIR / "baseline_candidate_units.csv", index=False)

    response = main.affected_units_list(10, 0, None, "baseline", REVIEWER)

    assert response["total"] == 1
    assert response["strategy"] == "baseline"
    assert "temp_excursion_exposed_label" not in response["items"][0]
    assert "Fallback baseline" in response["notice"]


def test_transport_alerts_endpoint_searches_and_paginates_without_labels(review_environment):
    pd.DataFrame([
        {
            "transfer_id": f"TR-{index}",
            "unit_id": f"UNIT-{index}",
            "component": "RBC",
            "blood_group": "O+",
            "unit_status": "in_stock",
            "from_facility_id": "FAC-1",
            "to_facility_id": "FAC-2",
            "transfer_type": "routine",
            "dispatched_at": "2026-01-01 10:00:00",
            "received_at": "2026-01-01 11:00:00",
            "transport_mode": "vehicle",
            "coolbox_max_temp_c": 7.1,
        }
        for index in range(2)
    ]).to_csv(main.OUTPUT_DIR / "transport_temperature_alerts.csv", index=False)

    response = main.transport_alerts(limit=1, offset=1, search="FAC-1")

    assert response["total"] == 2
    assert response["items"][0]["unit_id"] == "UNIT-1"
    assert response["items"][0]["coolbox_max_temp_c"] == 7.1
    assert "temp_excursion_exposed" not in response["items"][0]
    assert "not proof" in response["notice"]


def test_demo_login_sets_signed_http_only_session_cookie(review_environment):
    response = Response()
    result = main.login(
        main.DemoLoginRequest(
            username="supervisor-demo",
            password="supervisor-password-long",
        ),
        response,
    )
    cookie = response.headers["set-cookie"]
    session = cookie.split("trustledger_session=", 1)[1].split(";", 1)[0]
    secret, accounts = main._demo_auth_settings()

    user = main._decode_session_cookie(session, secret, accounts)

    assert user.actor_name == "Supervisor Reviewer"
    assert user.role == "blood_service_supervisor"
    assert result["user"]["username"] == "supervisor-demo"
    assert "httponly" in cookie.lower()
    assert "max-age=28800" in cookie.lower()


def test_authenticated_routes_require_server_session_dependency():
    public_auth_routes = {"/api/auth/login", "/api/auth/logout"}
    protected_routes = [
        route for route in main.app.routes
        if getattr(route, "path", "").startswith("/api/")
        and getattr(route, "path", "") not in public_auth_routes
    ]

    assert protected_routes
    assert all(
        any(dependency.call is main.require_authenticated_user for dependency in route.dependant.dependencies)
        for route in protected_routes
    )


def test_session_dependency_rejects_missing_cookie_and_accepts_signed_cookie(review_environment):
    with pytest.raises(HTTPException) as error:
        main.require_authenticated_user(None)
    assert error.value.status_code == 401

    secret, accounts = main._demo_auth_settings()
    session = main._session_cookie_value(REVIEWER, secret, int(main.time.time()) + 600)
    authenticated = main.require_authenticated_user(session)

    assert authenticated == REVIEWER


def test_demo_login_rejects_bad_credentials_without_identifying_account(review_environment):
    with pytest.raises(HTTPException) as error:
        main.login(
            main.DemoLoginRequest(username="facility-demo", password="wrong-password"),
            Response(),
        )
    assert error.value.status_code == 401
    assert error.value.detail == "Invalid username or password."


def test_signed_session_rejects_tampering_and_expiration(review_environment):
    secret, accounts = main._demo_auth_settings()
    token = main._session_cookie_value(REVIEWER, secret, 1)

    with pytest.raises(HTTPException) as expired:
        main._decode_session_cookie(token, secret, accounts)
    assert expired.value.status_code == 401

    with pytest.raises(HTTPException) as tampered:
        main._decode_session_cookie(token + "x", secret, accounts)
    assert tampered.value.status_code == 401


def test_authentication_fails_closed_when_demo_accounts_are_unconfigured(monkeypatch):
    for key in (
        "TRUSTLEDGER_AUTH_SECRET",
        "TRUSTLEDGER_DEMO_FACILITY_USERNAME",
        "TRUSTLEDGER_DEMO_FACILITY_PASSWORD",
        "TRUSTLEDGER_DEMO_FACILITY_NAME",
        "TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME",
        "TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD",
        "TRUSTLEDGER_DEMO_SUPERVISOR_NAME",
    ):
        monkeypatch.delenv(key, raising=False)

    with pytest.raises(HTTPException) as error:
        main.login(main.DemoLoginRequest(username="any", password="any"), Response())
    assert error.value.status_code == 503


def test_existing_audit_events_are_marked_legacy_after_schema_upgrade(tmp_path, monkeypatch):
    database = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(database) as connection:
        connection.execute(
            """
            CREATE TABLE review_events (
                review_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                actor_name TEXT NOT NULL,
                role TEXT NOT NULL,
                decision TEXT NOT NULL,
                reason TEXT NOT NULL,
                changed_assessment TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO review_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("legacy-id", "INC-00001", "Old Reviewer", "facility_staff", "accept", "Old demo record", None, "2026-01-01"),
        )
    monkeypatch.setattr(main, "AUDIT_DB_PATH", database)

    with main.closing(main._connect_audit_db()) as connection:
        row = connection.execute(
            "SELECT auth_method FROM review_events WHERE review_id = 'legacy-id'"
        ).fetchone()

    assert row["auth_method"] == "legacy_self_reported"
