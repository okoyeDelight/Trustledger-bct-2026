"""Executable adversarial proof — no clinical decisions and no real facility data."""
import pytest
from pydantic import ValidationError

from app.proof_lab import SCENARIOS, run_scenario, comparison_summary
from app.main import ImportContractObservation


def test_three_adversarial_scenarios_run_real_pipeline_rules():
    assert len(SCENARIOS) == 3
    results = {scenario["id"]: run_scenario(scenario["id"]) for scenario in SCENARIOS}
    assert "57-hour monitoring gap" in results["monitoring-gap"]["trustledger_conclusion"]
    assert any(r["value"] == "57" for r in results["monitoring-gap"]["evidence"])
    assert "location is unknown" in results["missing-receipt"]["trustledger_conclusion"]
    assert any(r["value"] == "0" for r in results["missing-receipt"]["evidence"])
    assert "does not establish" in results["sensor-glitch"]["trustledger_conclusion"]
    assert "99.9°C" in results["sensor-glitch"]["evidence"][0]["value"]
    assert all("not a statistically representative benchmark" in r["evaluation"] for r in results.values())
    assert all("conventional monitor" in r["competent_baseline"] or "custody-tracking" in r["competent_baseline"] for r in results.values())


def test_invalid_scenario_rejected():
    with pytest.raises(KeyError):
        run_scenario("invented")


def test_versioned_contract_accepts_complete_timestamped_fixture():
    event = ImportContractObservation(
        schema_version="trustledger.observation.v1",
        source_system="SyntheticMonitor",
        source_event_id="test-monitor-001",
        facility_id="SYN-A",
        observed_at="2026-10-01T09:00:00+01:00",
        temperature_c=4.2,
    )
    assert event.observed_at.utcoffset() is not None


@pytest.mark.parametrize("bad", [
    {"source_event_id": None},
    {"facility_id": None},
    {"observed_at": "2026-10-01T09:00:00"},
    {"schema_version": "abbis.v1"},
    {"temperature_c": "not-a-number"},
    {"unexpected_claim": "approved_for_transfusion"},
])
def test_proposed_import_rejects_missing_or_unknown_inputs(bad):
    payload = dict(
        schema_version="trustledger.observation.v1",
        source_system="SyntheticMonitor",
        source_event_id="test-monitor-001",
        facility_id="SYN-A",
        observed_at="2026-10-01T09:00:00+01:00",
        temperature_c=4.2,
    )
    payload.update(bad)
    with pytest.raises(ValidationError):
        ImportContractObservation(**payload)


def test_fair_competent_baseline_matches_on_all_three_fixtures():
    result = comparison_summary()
    assert result["scenario_count"] == 3
    assert result["trustledger_flagged"] == 3
    assert result["competent_baseline_flagged"] == 3
    assert result["same_alert_direction"] == 3
    assert "not estimates" in result["notice"]


def test_proof_lab_http_requires_login_and_import_never_persists(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main

    monkeypatch.setenv("TRUSTLEDGER_AUTH_SECRET", "synthetic-test-secret-with-adequate-length-and-entropy")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_USERNAME", "proof-worker")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_PASSWORD", "synthetic-proof-worker-password")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_FACILITY_NAME", "Proof Worker")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME", "proof-reviewer")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD", "synthetic-proof-supervisor-password")
    monkeypatch.setenv("TRUSTLEDGER_DEMO_SUPERVISOR_NAME", "Proof Reviewer")
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SECURE", "false")
    monkeypatch.setenv("TRUSTLEDGER_COOKIE_SAMESITE", "lax")

    with TestClient(main.app) as client:
        assert client.get("/api/proof-lab/scenarios").status_code == 401
        logged_in = client.post("/api/auth/login", json={
            "username": "proof-worker",
            "password": "synthetic-proof-worker-password",
        })
        assert logged_in.status_code == 200
        scenarios = client.get("/api/proof-lab/scenarios")
        assert scenarios.status_code == 200
        assert len(scenarios.json()["items"]) == 3

        for scenario in SCENARIOS:
            run = client.post(f"/api/proof-lab/scenarios/{scenario['id']}/run", json={})
            assert run.status_code == 200, run.text
            assert run.json()["rule_executed"]
        assert client.post("/api/proof-lab/scenarios/not-real/run", json={}).status_code == 404

        summary = client.get("/api/proof-lab/comparison")
        assert summary.status_code == 200
        assert summary.json()["same_alert_direction"] == 3

        valid = {
            "schema_version": "trustledger.observation.v1",
            "source_system": "SyntheticMonitor",
            "source_event_id": "fixture-001",
            "facility_id": "SYN-A",
            "observed_at": "2026-10-01T09:00:00+01:00",
            "temperature_c": 4.2,
        }
        accepted = client.post("/api/proof-lab/validate-import", json=valid)
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["persisted"] is False
        assert accepted.json()["accepted_for_schema_validation"] is True

        incomplete = {key: value for key, value in valid.items() if key != "observed_at"}
        assert client.post("/api/proof-lab/validate-import", json=incomplete).status_code == 422
        assert client.post("/api/proof-lab/validate-import", json={
            **valid, "unexpected_clinical_approval": True
        }).status_code == 422
