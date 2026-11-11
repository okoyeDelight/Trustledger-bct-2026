import pandas as pd
from app.services.pipeline import (
    build_incidents,
    build_location_intervals,
    build_transport_temperature_alerts,
    evaluate_candidate_matching,
    parse_timestamp_series,
    validate_temperature,
)


def test_timestamp_parser_recovers_missing_date_time_separator():
    parsed = parse_timestamp_series(pd.Series(["2025-11-0211:00:00", "2025-11-03 12:00:00"]))
    assert parsed.iloc[0] == pd.Timestamp("2025-11-02 11:00:00")
    assert parsed.iloc[1] == pd.Timestamp("2025-11-03 12:00:00")


def test_sentinel_values_are_not_counted_as_excursions():
    df = pd.DataFrame({
        "facility_id": ["F1"] * 4,
        "recorded_at": pd.date_range("2026-01-01", periods=4, freq="h"),
        "temp_c": [4.0, 7.0, 99.9, 1.0],
    })
    usable, quality = validate_temperature(df)
    assert quality["summary"]["known_sensor_glitch_rows"] == 1
    assert quality["summary"]["out_of_range_readings"] == 2
    incidents = build_incidents(usable)
    assert len(incidents) == 2


def test_missing_receipt_does_not_assume_destination_location():
    units = pd.DataFrame([{
        "unit_id": "U1", "processed_at_id": "F1", "collection_date": pd.Timestamp("2026-01-01"),
        "status": "in_stock", "status_date": pd.NaT,
    }])
    transfers = pd.DataFrame([{
        "unit_id": "U1", "from_facility_id": "F1", "to_facility_id": "F2",
        "dispatched_at": pd.Timestamp("2026-01-02"), "received_at": pd.NaT,
    }])
    intervals = build_location_intervals(units, transfers)
    assert len(intervals) == 1
    assert intervals.iloc[0]["facility_id"] == "F1"
    assert intervals.iloc[0]["end_time"] == pd.Timestamp("2026-01-02")


def test_sustained_event_evaluation_compares_against_single_reading_baseline():
    incidents = pd.DataFrame([
        {
            "incident_id": "INC-1", "facility_id": "F1",
            "start_time": pd.Timestamp("2026-01-01 01:00"),
            "end_time": pd.Timestamp("2026-01-01 02:00"), "severity": "sustained",
        },
        {
            "incident_id": "INC-2", "facility_id": "F1",
            "start_time": pd.Timestamp("2026-01-01 03:00"),
            "end_time": pd.Timestamp("2026-01-01 04:00"), "severity": "warning",
        },
    ])
    intervals = pd.DataFrame([
        {
            "unit_id": "U1", "facility_id": "F1",
            "start_time": pd.Timestamp("2026-01-01 00:00"),
            "end_time": pd.Timestamp("2026-01-01 03:00"),
        },
        {
            "unit_id": "U2", "facility_id": "F1",
            "start_time": pd.Timestamp("2026-01-01 03:00"),
            "end_time": pd.Timestamp("2026-01-01 05:00"),
        },
    ])
    units = pd.DataFrame([
        {"unit_id": "U1", "component": "RBC", "blood_group": "O+", "status": "in_stock", "temp_excursion_exposed": True},
        {"unit_id": "U2", "component": "RBC", "blood_group": "A+", "status": "in_stock", "temp_excursion_exposed": False},
        {"unit_id": "U3", "component": "RBC", "blood_group": "B+", "status": "in_stock", "temp_excursion_exposed": True},
    ])

    evaluation = evaluate_candidate_matching(incidents, intervals, units)

    assert evaluation["feature"]["candidate_units"] == 1
    assert evaluation["feature"]["precision"] == 1.0
    assert evaluation["feature"]["recall"] == 0.5
    assert evaluation["baseline"]["candidate_units"] == 2
    assert evaluation["baseline"]["precision"] == 0.5
    assert evaluation["baseline"]["recall"] == 0.5
    assert "temp_excursion_exposed" not in str(evaluation)


def test_transport_alerts_flag_only_rbc_wb_maxima_above_configured_limit():
    transfers = pd.DataFrame([
        {
            "transfer_id": "T1", "unit_id": "U1", "from_facility_id": "F1",
            "to_facility_id": "F2", "transfer_type": "routine",
            "dispatched_at": pd.Timestamp("2026-01-01 10:00"),
            "received_at": pd.Timestamp("2026-01-01 12:00"), "transport_mode": "vehicle",
            "coolbox_max_temp_c": 7.2,
        },
        {
            "transfer_id": "T2", "unit_id": "U2", "from_facility_id": "F1",
            "to_facility_id": "F2", "transfer_type": "routine",
            "dispatched_at": pd.Timestamp("2026-01-01 10:00"),
            "received_at": pd.Timestamp("2026-01-01 12:00"), "transport_mode": "vehicle",
            "coolbox_max_temp_c": 6.0,
        },
        {
            "transfer_id": "T3", "unit_id": "U3", "from_facility_id": "F1",
            "to_facility_id": "F2", "transfer_type": "routine",
            "dispatched_at": pd.Timestamp("2026-01-01 10:00"),
            "received_at": pd.Timestamp("2026-01-01 12:00"), "transport_mode": "vehicle",
            "coolbox_max_temp_c": 8.0,
        },
    ])
    units = pd.DataFrame([
        {"unit_id": "U1", "component": "RBC", "blood_group": "O+", "status": "in_stock"},
        {"unit_id": "U2", "component": "WB", "blood_group": "A+", "status": "transfused"},
        {"unit_id": "U3", "component": "PLT", "blood_group": "B+", "status": "in_stock"},
    ])

    alerts = build_transport_temperature_alerts(transfers, units)

    assert alerts["transfer_id"].tolist() == ["T1"]
    assert alerts.iloc[0]["coolbox_max_temp_c"] == 7.2
    assert "temp_excursion_exposed" not in alerts.columns
