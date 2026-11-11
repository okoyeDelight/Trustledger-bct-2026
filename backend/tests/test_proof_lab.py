"""Executable adversarial proof — no clinical decisions and no real facility data."""
import pytest
from pydantic import ValidationError

from app.proof_lab import SCENARIOS, run_scenario
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
