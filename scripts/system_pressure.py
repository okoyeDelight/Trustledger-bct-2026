#!/usr/bin/env python3
"""Reproduce the broad *synthetic* blood-system pressures in the starter ZIP.

No clinical effect/counterfactual is claimed. This is descriptive exploratory
analysis and a baseline illustration, not a model of actual Kenyan blood safety.

Usage: python3 scripts/system_pressure.py --source '/path/to/Hackathon Starter Dataset.zip'
"""
import argparse
import csv
import io
import json
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile

TIME = "%Y-%m-%d %H:%M:%S"

def read_table(z, name):
    with z.open(name + ".csv") as binary, io.TextIOWrapper(binary, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)

def analyze(archive):
    with ZipFile(archive) as z:
        unit_status = Counter()
        rbc_wb_status = Counter()
        exposure_transfused = 0
        for row in read_table(z, "units"):
            unit_status[row["status"]] += 1
            if row["component"] in {"RBC", "WB"}:
                rbc_wb_status[row["status"]] += 1
            if row["status"] == "transfused" and row["temp_excursion_exposed"].strip().lower() == "true":
                exposure_transfused += 1
        donors = Counter(r["donor_category"] for r in read_table(z, "donors"))
        requests = Counter()
        emergency_external_waits = []
        for row in read_table(z, "requests"):
            requests["total"] += 1
            if row["outcome"] != "fulfilled":
                requests["not_fully_fulfilled"] += 1
            if row["urgency"] == "emergency" and row["emergency_supplied_from_id"] and row["last_unit_available_at"]:
                hours = (datetime.strptime(row["last_unit_available_at"], TIME) -
                         datetime.strptime(row["requested_at"], TIME)).total_seconds() / 3600
                if hours >= 0: emergency_external_waits.append(hours)
        readings = defaultdict(list)
        for row in read_table(z, "temperature_logs"):
            readings[row["facility_id"]].append(
                (datetime.strptime(row["recorded_at"], TIME), float(row["temp_c"])))
        gaps = Counter()
        for series in readings.values():
            series.sort(key=lambda a: a[0])
            for (before_at, before_c), (after_at, after_c) in zip(series, series[1:]):
                hours = (after_at - before_at).total_seconds() / 3600
                if hours <= 1.01: continue
                gaps["intervals"] += 1
                gaps["missing_expected_hourly_records"] += max(0, round(hours) - 1)
                if 2 <= after_c <= 6: gaps["next_reading_normal"] += 1
                if 2 <= after_c <= 6 and 2 <= before_c <= 6: gaps["both_boundary_readings_normal"] += 1
        rbc_wb_total = sum(rbc_wb_status.values())
        wasted = rbc_wb_status["expired"] + rbc_wb_status["discarded_temperature"]
        donor_total = sum(donors.values())
        return {
            "source": "Terumo BCT Africa Hackathon 2026 starter dataset; entirely synthetic",
            "unit_status_all_components": dict(unit_status),
            "rbc_and_whole_blood": {
                "total": rbc_wb_total,
                "expired": rbc_wb_status["expired"],
                "discarded_temperature": rbc_wb_status["discarded_temperature"],
                "wasted_total": wasted,
                "wasted_percent": round(100 * wasted / rbc_wb_total, 2),
            },
            "transfused_with_retrospective_exposure_flag_all_components": exposure_transfused,
            "donor_records": {"all": donor_total, "student": donors["student"],
                              "student_percent": round(100 * donors["student"] / donor_total, 2)},
            "hospital_requests": {"total": requests["total"],
                                  "not_fully_fulfilled": requests["not_fully_fulfilled"]},
            "external_emergency_supply": {
                "count_with_timing": len(emergency_external_waits),
                "median_request_to_last_unit_hours": round(statistics.median(emergency_external_waits), 2)
                  if emergency_external_waits else None,
            },
            "monitoring_gaps": dict(gaps),
            "interpretation": [
                "These are retrospective synthetic outcomes, not observed real-world harm or preventable waste.",
                "An apparently normal reading after a gap is NOT evidence the omitted hours were safe.",
                "A monitoring-gap incident is NOT a count of exposed or discarded blood units.",
                "The starter temperature feed is facility-level; named refrigerator-to-unit history is unavailable.",
                "Student donor records may include duplicate candidate registrations; student share does not prove a specific calendar-month shortage.",
                "Expiry-related waste, cold-chain discards, and unflagged exposure are different operational failures.",
                "Nothing here estimates how many units TrustLedger would save or what it would do to patient outcomes.",
            ],
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    report = json.dumps(analyze(args.source), indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8")
    print(report)
