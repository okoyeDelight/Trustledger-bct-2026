from __future__ import annotations

from pathlib import Path
from typing import Any
import json
import os

import numpy as np
import pandas as pd

REQUIRED_FILES = {
    "facilities": "facilities.csv",
    "temperature": "temperature_logs.csv",
    "units": "units.csv",
    "donations": "donations.csv",
    "transfers": "transfers.csv",
    "outages": "power_outages.csv",
}
SENTINEL_TEMPERATURES = {-99.0, 99.9, 0.0}
SAFE_MIN_C = float(os.environ.get("TRUSTLEDGER_TEMP_MIN_C", "2.0"))
SAFE_MAX_C = float(os.environ.get("TRUSTLEDGER_TEMP_MAX_C", "6.0"))
if SAFE_MIN_C >= SAFE_MAX_C:
    raise ValueError("TRUSTLEDGER_TEMP_MIN_C must be lower than TRUSTLEDGER_TEMP_MAX_C")


def _read_csv(data_dir: Path, filename: str, date_columns: list[str] | None = None) -> pd.DataFrame:
    path = data_dir / filename
    if not path.exists():
        raise FileNotFoundError(f"Required dataset file not found: {path}")
    df = pd.read_csv(path)
    for col in date_columns or []:
        if col in df.columns:
            df[col] = parse_timestamp_series(df[col])
    return df


def parse_timestamp_series(values: pd.Series) -> pd.Series:
    text = values.astype("string").str.strip().str.replace(
        r"^(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$",
        r"\1 \2",
        regex=True,
    )
    return pd.to_datetime(text, errors="coerce")


def load_inputs(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    root = Path(data_dir)
    return {
        "facilities": _read_csv(root, REQUIRED_FILES["facilities"]),
        "temperature": _read_csv(root, REQUIRED_FILES["temperature"], ["recorded_at"]),
        "units": _read_csv(root, REQUIRED_FILES["units"], ["collection_date", "expiry_date", "status_date"]),
        "donations": _read_csv(root, REQUIRED_FILES["donations"], ["collection_date", "tested_date"]),
        "transfers": _read_csv(root, REQUIRED_FILES["transfers"], ["dispatched_at", "received_at"]),
        "outages": _read_csv(root, REQUIRED_FILES["outages"], ["start_time", "end_time"]),
    }


def validate_temperature(temperature: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    required = {"facility_id", "recorded_at", "temp_c"}
    missing_columns = sorted(required - set(temperature.columns))
    if missing_columns:
        raise ValueError(f"temperature_logs.csv is missing columns: {missing_columns}")

    df = temperature.copy()
    df["temp_c"] = pd.to_numeric(df["temp_c"], errors="coerce")
    df["is_missing_value"] = df["temp_c"].isna() | df["recorded_at"].isna()
    df["is_sentinel_glitch"] = df["temp_c"].isin(SENTINEL_TEMPERATURES)

    duplicate_mask = df.duplicated(["facility_id", "recorded_at"], keep=False)
    duplicate_rows = int(duplicate_mask.sum())
    conflicting_duplicate_timestamps = 0
    if duplicate_rows:
        grouped = df.loc[duplicate_mask].groupby(["facility_id", "recorded_at"])["temp_c"].nunique(dropna=False)
        conflicting_duplicate_timestamps = int((grouped > 1).sum())

    # Do not allow duplicated or conflicting timestamps to create artificial incidents.
    # Exact duplicates are collapsed; conflicting duplicate timestamps are excluded.
    conflict_keys = set()
    if duplicate_rows:
        grouped = df.loc[duplicate_mask].groupby(["facility_id", "recorded_at"])["temp_c"].nunique(dropna=False)
        conflict_keys = set(grouped[grouped > 1].index.tolist())
    df["_key"] = list(zip(df["facility_id"], df["recorded_at"]))
    df = df[~df["_key"].isin(conflict_keys)].copy()
    df = df.sort_values(["facility_id", "recorded_at"]).drop_duplicates(
        ["facility_id", "recorded_at"], keep="first"
    )

    df["quality_status"] = "valid"
    df.loc[df["is_missing_value"], "quality_status"] = "missing_value_or_timestamp"
    df.loc[df["is_sentinel_glitch"], "quality_status"] = "known_sensor_glitch"
    df.loc[df["_key"].isin(conflict_keys), "quality_status"] = "conflicting_duplicate_timestamp"

    # Sentinel values are invalid measurements, not genuine cold-chain excursions.
    usable = df[
        df["recorded_at"].notna()
        & df["temp_c"].notna()
        & ~df["is_sentinel_glitch"]
        & ~df["_key"].isin(conflict_keys)
    ].copy()
    usable["is_out_of_range"] = (usable["temp_c"] < SAFE_MIN_C) | (usable["temp_c"] > SAFE_MAX_C)
    usable["excursion_direction"] = np.select(
        [usable["temp_c"] < SAFE_MIN_C, usable["temp_c"] > SAFE_MAX_C],
        ["below_range", "above_range"],
        default="within_range",
    )

    # Estimate missing hourly observations using each facility's observed first/last timestamp.
    gap_rows = []
    all_timestamps = temperature["recorded_at"].dropna()
    if not all_timestamps.empty:
        global_start, global_end = all_timestamps.min(), all_timestamps.max()
        expected = int((global_end - global_start).total_seconds() // 3600) + 1
        for facility_id, group in temperature.dropna(subset=["recorded_at"]).groupby("facility_id"):
            observed = group["recorded_at"].drop_duplicates().sort_values()
            actual = int(len(observed))
            gap_rows.append({
                "facility_id": facility_id,
                "first_reading": observed.min(),
                "last_reading": observed.max(),
                "expected_hourly_readings": expected,
                "observed_timestamps": actual,
                "missing_hourly_readings_estimate": max(expected - actual, 0),
            })
    gaps = pd.DataFrame(gap_rows)

    summary = {
        "raw_rows": int(len(temperature)),
        "usable_rows": int(len(usable)),
        "missing_temperature_or_timestamp_rows": int(df["is_missing_value"].sum()),
        "known_sensor_glitch_rows": int(df["is_sentinel_glitch"].sum()),
        "duplicate_rows": duplicate_rows,
        "conflicting_duplicate_timestamps": conflicting_duplicate_timestamps,
        "estimated_missing_hourly_readings": int(gaps["missing_hourly_readings_estimate"].sum()) if not gaps.empty else 0,
        "out_of_range_readings": int(usable["is_out_of_range"].sum()),
        "above_range_readings": int((usable["temp_c"] > SAFE_MAX_C).sum()),
        "below_range_readings": int((usable["temp_c"] < SAFE_MIN_C).sum()),
    }
    return usable, {"summary": summary, "facility_gaps": gaps}


def build_incidents(usable_temperature: pd.DataFrame) -> pd.DataFrame:
    """Group consecutive hourly out-of-range readings into incident windows.

    A single out-of-range hourly observation creates a one-hour provisional window.
    This is an operational flag, not a clinical disposition.
    """
    out = usable_temperature[usable_temperature["is_out_of_range"]].copy()
    columns = ["incident_id", "facility_id", "start_time", "end_time", "duration_hours",
               "reading_count", "peak_temp_c", "minimum_temp_c", "direction", "severity", "sustained_rule"]
    if out.empty:
        return pd.DataFrame(columns=columns)

    out = out.sort_values(["facility_id", "recorded_at"])
    hour_gap = out.groupby("facility_id")["recorded_at"].diff().dt.total_seconds().div(3600)
    new_group = hour_gap.isna() | (hour_gap > 1.01)
    out["_episode"] = new_group.groupby(out["facility_id"]).cumsum().astype(int)

    records = []
    for (facility_id, episode), group in out.groupby(["facility_id", "_episode"]):
        start = group["recorded_at"].min()
        last = group["recorded_at"].max()
        # Hourly logger data only bounds the incident approximately.
        end = last + pd.Timedelta(hours=1)
        directions = sorted(set(group["excursion_direction"]))
        records.append({
            "facility_id": facility_id,
            "start_time": start,
            "end_time": end,
            "duration_hours": round((end - start).total_seconds() / 3600, 2),
            "reading_count": int(len(group)),
            "peak_temp_c": float(group["temp_c"].max()),
            "minimum_temp_c": float(group["temp_c"].min()),
            "direction": ",".join(directions),
            "severity": "sustained" if len(group) >= 4 and (group["temp_c"] > SAFE_MAX_C).all() else "warning",
            "sustained_rule": "4 consecutive hourly readings above 6°C" if len(group) >= 4 and (group["temp_c"] > SAFE_MAX_C).all() else "No sustained-event threshold met",
        })
    incidents = pd.DataFrame(records).sort_values(["start_time", "facility_id"]).reset_index(drop=True)
    incidents.insert(0, "incident_id", [f"INC-{i:05d}" for i in range(1, len(incidents) + 1)])
    return incidents[columns]


def build_location_intervals(units: pd.DataFrame, transfers: pd.DataFrame, donations: pd.DataFrame | None = None) -> pd.DataFrame:
    """Conservatively reconstruct known facility-holding intervals for each unit.

    A unit is treated as in transit from dispatch until confirmed receipt. If receipt
    is missing, its location becomes unknown from dispatch onward. This avoids
    claiming a unit was at a destination without a confirmed receipt timestamp.
    """
    required_units = {"unit_id", "processed_at_id", "collection_date", "status", "status_date"}
    required_transfers = {"unit_id", "from_facility_id", "to_facility_id", "dispatched_at", "received_at"}
    if required_units - set(units.columns) or required_transfers - set(transfers.columns):
        raise ValueError("Units/transfers data is missing columns needed for location reconstruction")

    tested_dates = {}
    if donations is not None and {"donation_id", "tested_date"}.issubset(donations.columns):
        tested_dates = donations.set_index("donation_id")["tested_date"].to_dict()
    tr = transfers.sort_values(["unit_id", "dispatched_at"]).copy()
    by_unit = {unit_id: grp for unit_id, grp in tr.groupby("unit_id", sort=False)}
    dataset_end = pd.Timestamp("2026-11-01 00:00:00")
    rows: list[dict[str, Any]] = []

    for unit in units.itertuples(index=False):
        unit_id = getattr(unit, "unit_id")
        opening_stock = bool(getattr(unit, "opening_stock", False))
        location = getattr(unit, "current_facility_id") if opening_stock and hasattr(unit, "current_facility_id") else getattr(unit, "processed_at_id")
        collection_date = getattr(unit, "collection_date")
        donation_id = getattr(unit, "donation_id") if hasattr(unit, "donation_id") else None
        tested_date = tested_dates.get(donation_id) if donation_id is not None else None
        cursor = pd.Timestamp("2025-11-01 00:00:00") if opening_stock else (tested_date if pd.notna(tested_date) else collection_date)
        status_date = getattr(unit, "status_date")
        if pd.isna(cursor):
            continue
        # status_date is date-granularity in this dataset; retain the unit through
        # the end of that day rather than truncating at midnight.
        hard_end = (status_date + pd.Timedelta(days=1)) if pd.notna(status_date) else dataset_end
        hard_end = min(hard_end, dataset_end)
        if hard_end < cursor:
            hard_end = cursor

        group = by_unit.get(unit_id)
        if group is not None:
            for transfer in group.itertuples(index=False):
                dispatched = getattr(transfer, "dispatched_at")
                received = getattr(transfer, "received_at")
                source = getattr(transfer, "from_facility_id")
                destination = getattr(transfer, "to_facility_id")
                if pd.isna(dispatched) or dispatched > hard_end:
                    continue
                # Close a known holding interval only when source location is consistent.
                if location is not None and pd.notna(location) and location == source and dispatched >= cursor:
                    if dispatched > cursor:
                        rows.append({"unit_id": unit_id, "facility_id": location, "start_time": cursor,
                                     "end_time": min(dispatched, hard_end)})
                # Dispatch proves the unit left the source. Do not assume it arrived until receipt.
                location = None
                cursor = dispatched
                if pd.notna(received) and received >= dispatched and received <= hard_end:
                    location = destination
                    cursor = received
                elif pd.notna(received) and received > hard_end:
                    break
        if location is not None and pd.notna(location) and hard_end > cursor:
            rows.append({"unit_id": unit_id, "facility_id": location, "start_time": cursor, "end_time": hard_end})

    intervals = pd.DataFrame(rows, columns=["unit_id", "facility_id", "start_time", "end_time"])
    if not intervals.empty:
        intervals = intervals[intervals["end_time"] > intervals["start_time"]]
        intervals = intervals.sort_values(["facility_id", "start_time"]).reset_index(drop=True)
    return intervals


def match_affected_units(incidents: pd.DataFrame, intervals: pd.DataFrame, units: pd.DataFrame) -> pd.DataFrame:
    """Find units whose confirmed facility-holding interval overlaps an incident."""
    cols = ["incident_id", "unit_id", "facility_id", "exposure_start", "exposure_end", "component",
            "blood_group", "unit_status", "temp_excursion_exposed_label"]
    if incidents.empty or intervals.empty:
        return pd.DataFrame(columns=cols)

    unit_meta_cols = [c for c in ["unit_id", "component", "blood_group", "status", "temp_excursion_exposed"] if c in units.columns]
    meta = units[unit_meta_cols].drop_duplicates("unit_id").rename(columns={
        "status": "unit_status", "temp_excursion_exposed": "temp_excursion_exposed_label"
    })
    if "component" in meta.columns:
        meta = meta[meta["component"].isin(["RBC", "WB"])].copy()
        eligible_units = set(meta["unit_id"])
        intervals = intervals[intervals["unit_id"].isin(eligible_units)].copy()
    # The starter generator defines a fridge excursion day after four consecutive
    # hourly readings above 6°C. Shorter episodes remain visible as warnings, but
    # only sustained episodes are traced to inventory in this first MVP.
    sustained_incidents = incidents[incidents["severity"] == "sustained"] if "severity" in incidents.columns else incidents
    matches = []
    for facility_id, facility_incidents in sustained_incidents.groupby("facility_id"):
        facility_intervals = intervals[intervals["facility_id"] == facility_id]
        if facility_intervals.empty:
            continue
        starts = facility_intervals["start_time"].to_numpy(dtype="datetime64[ns]")
        ends = facility_intervals["end_time"].to_numpy(dtype="datetime64[ns]")
        for incident in facility_incidents.itertuples(index=False):
            left = np.searchsorted(starts, np.datetime64(incident.end_time), side="left")
            candidate_idx = np.flatnonzero(ends[:left] > np.datetime64(incident.start_time))
            if len(candidate_idx) == 0:
                continue
            candidates = facility_intervals.iloc[candidate_idx]
            for row in candidates.itertuples(index=False):
                overlap_start = max(row.start_time, incident.start_time)
                overlap_end = min(row.end_time, incident.end_time)
                if overlap_end > overlap_start:
                    matches.append({
                        "incident_id": incident.incident_id,
                        "unit_id": row.unit_id,
                        "facility_id": facility_id,
                        "exposure_start": overlap_start,
                        "exposure_end": overlap_end,
                    })
    if not matches:
        return pd.DataFrame(columns=cols)
    result = pd.DataFrame(matches).drop_duplicates(["incident_id", "unit_id"])
    result = result.merge(meta, on="unit_id", how="left")
    return result[cols].sort_values(["incident_id", "unit_id"]).reset_index(drop=True)


def match_baseline_affected_units(
    incidents: pd.DataFrame,
    intervals: pd.DataFrame,
    units: pd.DataFrame,
) -> pd.DataFrame:
    """Apply the simple baseline: match every out-of-range episode to inventory."""
    baseline_incidents = incidents.copy()
    if not baseline_incidents.empty:
        baseline_incidents["severity"] = "sustained"
    return match_affected_units(baseline_incidents, intervals, units)


def correlate_power_outages(incidents: pd.DataFrame, outages: pd.DataFrame) -> pd.DataFrame:
    if incidents.empty or outages.empty:
        return pd.DataFrame(columns=["incident_id", "outage_id", "backup_power_engaged", "overlap_minutes"])
    rows = []
    by_facility = {k: g for k, g in outages.groupby("facility_id")}
    for inc in incidents.itertuples(index=False):
        group = by_facility.get(inc.facility_id)
        if group is None:
            continue
        overlap = group[(group["start_time"] < inc.end_time) & (group["end_time"] > inc.start_time)]
        for outage in overlap.itertuples(index=False):
            start = max(inc.start_time, outage.start_time)
            end = min(inc.end_time, outage.end_time)
            rows.append({"incident_id": inc.incident_id, "outage_id": outage.outage_id,
                         "backup_power_engaged": bool(outage.backup_power_engaged),
                         "overlap_minutes": round((end - start).total_seconds() / 60, 1)})
    return pd.DataFrame(rows)


def build_transport_temperature_alerts(
    transfers: pd.DataFrame, units: pd.DataFrame
) -> pd.DataFrame:
    """Return RBC/WB transfers whose recorded cool-box maximum exceeds the configured limit."""
    columns = [
        "transfer_id", "unit_id", "component", "blood_group", "unit_status",
        "from_facility_id", "to_facility_id", "transfer_type", "dispatched_at",
        "received_at", "transport_mode", "coolbox_max_temp_c",
    ]
    required_transfers = {
        "transfer_id", "unit_id", "from_facility_id", "to_facility_id",
        "transfer_type", "dispatched_at", "received_at", "transport_mode",
        "coolbox_max_temp_c",
    }
    required_units = {"unit_id", "component", "blood_group", "status"}
    if required_transfers - set(transfers.columns) or required_units - set(units.columns):
        raise ValueError("Transfers/units data is missing columns needed for transport temperature review")
    if transfers.empty or units.empty:
        return pd.DataFrame(columns=columns)

    unit_meta = units[["unit_id", "component", "blood_group", "status"]].drop_duplicates("unit_id")
    unit_meta = unit_meta.rename(columns={"status": "unit_status"})
    records = transfers.merge(unit_meta, on="unit_id", how="inner")
    records["coolbox_max_temp_c"] = pd.to_numeric(records["coolbox_max_temp_c"], errors="coerce")
    alerts = records[
        records["component"].isin(["RBC", "WB"])
        & records["coolbox_max_temp_c"].gt(SAFE_MAX_C)
    ]
    return alerts[columns].sort_values(
        ["dispatched_at", "transfer_id"], na_position="last"
    ).reset_index(drop=True)


def evaluate_candidate_matching(
    incidents: pd.DataFrame,
    intervals: pd.DataFrame,
    units: pd.DataFrame,
    baseline_rows: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Compare the sustained-event feature with a one-reading baseline.

    Evaluation labels are read only for aggregate metrics and never included in
    operational candidate records or the returned API response.
    """
    label_column = "temp_excursion_exposed"
    if label_column not in units.columns or "unit_id" not in units.columns:
        return {
            "available": False,
            "note": "The dataset does not include evaluation labels.",
        }

    evaluation_units = units
    if "component" in units.columns:
        evaluation_units = units[units["component"].isin(["RBC", "WB"])]
    labeled_units = evaluation_units[["unit_id", label_column]].drop_duplicates("unit_id").copy()
    actual = set(
        labeled_units.loc[
            labeled_units[label_column].astype(str).str.lower().isin({"true", "1", "yes"}),
            "unit_id",
        ]
    )
    population = set(labeled_units["unit_id"])

    feature_rows = match_affected_units(incidents, intervals, units)
    if baseline_rows is None:
        baseline_rows = match_baseline_affected_units(incidents, intervals, units)

    def metrics(rows: pd.DataFrame) -> dict[str, Any]:
        predicted = set(rows["unit_id"]) & population if not rows.empty else set()
        true_positive = len(predicted & actual)
        false_positive = len(predicted - actual)
        false_negative = len(actual - predicted)
        true_negative = len(population - actual - predicted)
        return {
            "candidate_units": len(predicted),
            "true_positive": true_positive,
            "false_positive": false_positive,
            "false_negative": false_negative,
            "true_negative": true_negative,
            "precision": round(true_positive / len(predicted), 4) if predicted else 0.0,
            "recall": round(true_positive / len(actual), 4) if actual else 0.0,
        }

    return {
        "available": True,
        "feature_name": f"Four consecutive hourly readings above {SAFE_MAX_C:g}°C",
        "baseline_name": "Any single out-of-range reading",
        "population_units": len(population),
        "labeled_exposed_units": len(actual),
        "feature": metrics(feature_rows),
        "baseline": metrics(baseline_rows),
        "note": (
            "Retrospective evaluation on the supplied synthetic dataset using its "
            "evaluation-only exposure labels. This is not a held-out test and does "
            "not establish performance on other sites or real-world data."
        ),
    }


def run_pipeline(data_dir: str | Path, output_dir: str | Path) -> dict[str, Any]:
    inputs = load_inputs(data_dir)
    usable, quality = validate_temperature(inputs["temperature"])
    incidents = build_incidents(usable)
    intervals = build_location_intervals(inputs["units"], inputs["transfers"], inputs["donations"])
    affected = match_affected_units(incidents, intervals, inputs["units"])
    baseline_affected = match_baseline_affected_units(incidents, intervals, inputs["units"])
    feature_evaluation = evaluate_candidate_matching(
        incidents, intervals, inputs["units"], baseline_rows=baseline_affected
    )
    outage_matches = correlate_power_outages(incidents, inputs["outages"])
    transport_alerts = build_transport_temperature_alerts(inputs["transfers"], inputs["units"])

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    incidents.to_csv(out_dir / "incidents.csv", index=False)
    affected.to_csv(out_dir / "potentially_affected_units.csv", index=False)
    baseline_affected.drop(
        columns=["temp_excursion_exposed_label"], errors="ignore"
    ).to_csv(out_dir / "baseline_candidate_units.csv", index=False)
    intervals.to_csv(out_dir / "unit_location_intervals.csv", index=False)
    quality["facility_gaps"].to_csv(out_dir / "temperature_gaps_by_facility.csv", index=False)
    outage_matches.to_csv(out_dir / "incident_power_correlations.csv", index=False)
    transport_alerts.to_csv(out_dir / "transport_temperature_alerts.csv", index=False)

    summary = {
        "site_name": os.environ.get("TRUSTLEDGER_SITE_NAME", "TrustLedger"),
        "country": os.environ.get("TRUSTLEDGER_COUNTRY", "Kenya"),
        "temperature_policy": {"minimum_c": SAFE_MIN_C, "maximum_c": SAFE_MAX_C},
        "dataset_note": "Synthetic Terumo BCT Africa Hackathon starter dataset; not real facility or patient data.",
        "temperature_quality": quality["summary"],
        "feature_evaluation": feature_evaluation,
        "incident_count": int(len(incidents)),
        "sustained_incident_count": int((incidents["severity"] == "sustained").sum()) if "severity" in incidents.columns else int(len(incidents)),
        "warning_episode_count": int((incidents["severity"] == "warning").sum()) if "severity" in incidents.columns else 0,
        "potentially_affected_unit_matches": int(len(affected)),
        "unique_potentially_affected_units": int(affected["unit_id"].nunique()) if not affected.empty else 0,
        "incidents_with_power_outage_overlap": int(outage_matches["incident_id"].nunique()) if not outage_matches.empty else 0,
        "transport_temperature_alert_count": int(len(transport_alerts)),
        "location_intervals_built": int(len(intervals)),
        "safety_note": "Matches are investigation candidates only. They do not establish product safety or authorize release, transfusion, discard, or quarantine removal.",
    }
    (out_dir / "pipeline_summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    return summary
