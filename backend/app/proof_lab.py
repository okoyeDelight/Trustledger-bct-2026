"""Reproducible, synthetic-only judge challenges using the production pipeline rules.

Challenge inputs are intentionally small fixtures; results are computed afresh.
This is not an AI predictor, live sensor feed, clinical assessment or proof of
superiority over an adequate conventional monitoring system.
"""
from datetime import datetime
from typing import Any

import pandas as pd

from app.services.pipeline import (
    build_incidents,
    build_location_intervals,
    validate_temperature,
)

SCENARIOS = [
    {
        "id": "monitoring-gap",
        "title": "The deceptive green reading",
        "question": "Latest reading is 4°C. What happened during the unobserved interval?",
        "source": "Reproducible synthetic time-series fixture",
        "risk": "No reading is not evidence of a safe temperature",
    },
    {
        "id": "missing-receipt",
        "title": "The missing transfer receipt",
        "question": "A unit left Facility A, but Facility B has no receipt. Where was it?",
        "source": "Reproducible synthetic unit and transfer fixture",
        "risk": "Dispatch does not establish arrival",
    },
    {
        "id": "sensor-glitch",
        "title": "The suspicious 99.9°C spike",
        "question": "A logger recorded a sentinel value of 99.9°C. Was exposure established?",
        "source": "Reproducible synthetic temperature fixture",
        "risk": "A known invalid reading cannot prove a genuine excursion",
    },
]

def _iso(value: Any) -> str:
    return pd.Timestamp(value).isoformat()

def run_scenario(scenario_id: str) -> dict[str, Any]:
    meta = next((s for s in SCENARIOS if s["id"] == scenario_id), None)
    if meta is None:
        raise KeyError("Unknown scenario")

    if scenario_id == "monitoring-gap":
        raw = pd.DataFrame([
            {"facility_id": "SYN-A", "recorded_at": pd.Timestamp("2026-10-01 09:00:00"), "temp_c": 4.2},
            {"facility_id": "SYN-A", "recorded_at": pd.Timestamp("2026-10-03 19:00:00"), "temp_c": 4.0},
        ])
        usable, quality = validate_temperature(raw)
        missing = int(quality["summary"]["estimated_missing_hourly_readings"])
        assert missing == 57
        incident_count = len(build_incidents(usable))
        evidence = [
            {"label": "First record", "value": f"{_iso(raw.iloc[0]['recorded_at'])} · 4.2°C"},
            {"label": "Latest record", "value": f"{_iso(raw.iloc[1]['recorded_at'])} · 4.0°C"},
            {"label": "Missing hourly records", "value": str(missing)},
            {"label": "Verified excursions in observed samples", "value": str(incident_count)},
        ]
        naive = "Latest sample 4.0°C is in range; naive latest-only screen looks green."
        competent = "A gap-aware conventional monitor flags the 57 missing hourly records."
        conclusion = "Investigate the 57-hour monitoring gap. Temperature during the gap is unknown."
        rule = "Hourly timestamp continuity (validate_temperature); no inferred readings"
    elif scenario_id == "missing-receipt":
        units = pd.DataFrame([{
            "unit_id": "SYN-UNIT-001",
            "processed_at_id": "SYN-A",
            "collection_date": pd.Timestamp("2026-10-01 08:00:00"),
            "status": "in_stock",
            "status_date": pd.NaT,
        }])
        transfers = pd.DataFrame([{
            "unit_id": "SYN-UNIT-001",
            "from_facility_id": "SYN-A",
            "to_facility_id": "SYN-B",
            "dispatched_at": pd.Timestamp("2026-10-02 11:00:00"),
            "received_at": pd.NaT,
        }])
        intervals = build_location_intervals(units, transfers)
        observed = intervals.to_dict("records")
        destination_assumed = any(r["facility_id"] == "SYN-B" for r in observed)
        if destination_assumed:
            raise AssertionError("Unsafe inference: destination was assumed without receipt")
        evidence = [
            {"label": "Documented dispatch", "value": "2026-10-02 11:00 · SYN-A → SYN-B"},
            {"label": "Documented receipt", "value": "None"},
            {"label": "Confirmed destination intervals", "value": "0"},
            {"label": "Known holding intervals before dispatch", "value": str(len(observed))},
        ]
        naive = "A naive transfer table may show SYN-B as the listed destination."
        competent = "An appropriate custody-tracking system also requires receipt before confirming arrival."
        conclusion = "Unit location is unknown after dispatch; do not claim destination exposure."
        rule = "Confirmed-receipt custody intervals (build_location_intervals)"
    else:
        raw = pd.DataFrame([
            {"facility_id": "SYN-A", "recorded_at": pd.Timestamp("2026-10-01 09:00:00"), "temp_c": 4.0},
            {"facility_id": "SYN-A", "recorded_at": pd.Timestamp("2026-10-01 10:00:00"), "temp_c": 99.9},
            {"facility_id": "SYN-A", "recorded_at": pd.Timestamp("2026-10-01 11:00:00"), "temp_c": 4.2},
        ])
        usable, quality = validate_temperature(raw)
        glitches = int(quality["summary"]["known_sensor_glitch_rows"])
        episode_count = len(build_incidents(usable))
        evidence = [
            {"label": "Raw readings", "value": "4.0°C → 99.9°C → 4.2°C"},
            {"label": "Known sentinel glitches", "value": str(glitches)},
            {"label": "Usable temperature readings", "value": str(len(usable))},
            {"label": "Verified excursions in usable data", "value": str(episode_count)},
        ]
        naive = "A naive threshold check incorrectly treats 99.9°C as a genuine spike."
        competent = "A sensor-quality-aware conventional monitor also quarantines sentinel readings."
        conclusion = "Investigate sensor quality; this sentinel alone does not establish a temperature excursion."
        rule = "Sentinel exclusion (validate_temperature), then episode detection (build_incidents)"

    return {
        **meta,
        "rule_executed": rule,
        "evidence": evidence,
        "naive_comparison": naive,
        "competent_baseline": competent,
        "trustledger_conclusion": conclusion,
        "next_step": "Document evidence and unknowns; a different supervisor reviews the investigation flag.",
        "decision_scope": "Investigation triage only. No clinical product disposition or blood-unit release.",
        "evaluation": "Three hand-designed synthetic challenges, not a statistically representative benchmark.",
    }
