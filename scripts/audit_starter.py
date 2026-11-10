#!/usr/bin/env python3
"""Traceable cleansing of the organizer's SYNTHETIC starter data.

Source columns are preserved. No temperature is fabricated, no unknown
blood group is imputed, and candidate donor identities are never merged.

python3 scripts/audit_starter.py --source 'Hackathon Starter Dataset.zip' --out ./derived
"""
from __future__ import annotations
import argparse
import csv
import io
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile

SENTINELS = {-99.0, 99.9, 0.0}  # As documented in source DATA_DICTIONARY.md
VALID_GROUPS = {"O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"}
TIME = "%Y-%m-%d %H:%M:%S"

def rows(z, name):
    with z.open(name) as stream, io.TextIOWrapper(stream, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)

def perform(source: Path, out: Path, report_only=False):
    out.mkdir(parents=True, exist_ok=True)
    with ZipFile(source) as z:
        d = z.read("DATA_DICTIONARY.md").decode("utf-8-sig")
        if "-99.0" not in d or "99.9" not in d:
            raise ValueError("Expected organizer sentinel definitions missing")
        facility_names = {r["facility_id"]: r["name"] for r in rows(z, "facilities.csv")}
        stats = Counter()
        examples = []
        # Stable ID joins; a raw-name mismatch is NOT necessarily misspelling.
        req_file = None
        req_writer = None
        try:
            if not report_only:
                req_file = (out / "requests_reconciled.csv").open("w", newline="", encoding="utf-8")
            for r in rows(z, "requests.csv"):
                if req_file and req_writer is None:
                    fields = list(r) + ["facility_name_canonical", "facility_name_quality"]
                    req_writer = csv.DictWriter(req_file, fieldnames=fields)
                    req_writer.writeheader()
                stats["request_records"] += 1
                canonical = facility_names.get(r["facility_id"])
                if canonical is None:
                    flag = "unknown_facility_id"
                    stats["requests_unknown_facility_id"] += 1
                elif canonical != r["facility_name_raw"]:
                    flag = "canonicalized_by_valid_facility_id"
                    stats["requests_names_differ_from_canonical"] += 1
                    if len(examples) < 8:
                        examples.append({"type": "facility_name_variant", "request_id": r["request_id"],
                          "facility_id": r["facility_id"], "raw": r["facility_name_raw"], "canonical": canonical})
                else:
                    flag = "exact_name_match"
                if r["patient_blood_group"] not in VALID_GROUPS:
                    stats["requests_patient_group_missing_or_unknown"] += 1
                if req_writer:
                    req_writer.writerow({**r, "facility_name_canonical": canonical or "", "facility_name_quality": flag})
        finally:
            if req_file: req_file.close()
        # Identify candidates only. Two persons may share these four fields.
        donors = defaultdict(list)
        for r in rows(z, "donors.csv"):
            stats["donor_records"] += 1
            if r["blood_group"] not in VALID_GROUPS:
                stats["donor_group_missing_or_unknown"] += 1
            key = (r["birth_date"], r["sex"], r["home_county"], r["phone_last4"])
            if all(key): donors[key].append(r["donor_id"])
        candidates = [ids for ids in donors.values() if len(ids) > 1]
        stats["candidate_duplicate_donor_groups"] = len(candidates)
        stats["candidate_duplicate_donor_records"] = sum(len(x) for x in candidates)
        stats["candidate_duplicate_extra_records"] = sum(len(x) - 1 for x in candidates)
        temp_file = gap_file = None
        tw = gw = None
        try:
            if not report_only:
                temp_file = (out / "temperature_validated.csv").open("w", newline="", encoding="utf-8")
                tw = csv.DictWriter(temp_file, fieldnames=[
                    "facility_id", "recorded_at", "temp_c_raw", "temp_c_validated", "quality_flag"])
                tw.writeheader()
                gap_file = (out / "missing_temperature_intervals.csv").open("w", newline="", encoding="utf-8")
                gw = csv.DictWriter(gap_file, fieldnames=[
                    "facility_id", "after_reading", "before_reading", "missing_expected_hourly_records"])
                gw.writeheader()
            previous = {}
            for r in rows(z, "temperature_logs.csv"):
                stats["temperature_records"] += 1
                facility, when = r["facility_id"], r["recorded_at"]
                try: t = datetime.strptime(when, TIME)
                except ValueError:
                    t = None
                    stats["temperature_invalid_timestamps"] += 1
                try: value = float(r["temp_c"])
                except (ValueError, TypeError): value = None
                if value is None:
                    flag, valid = "invalid_numeric", ""
                    stats["temperature_invalid_numeric"] += 1
                elif value in SENTINELS:
                    flag, valid = "documented_sensor_glitch", ""
                    stats["temperature_sentinel_glitches"] += 1
                    stats[f"temperature_sentinel_{value:g}"] += 1
                    if len(examples) < 20: examples.append({"type": "sensor_glitch", **r})
                elif value < -10 or value > 25:
                    flag, valid = "implausible_requires_review", ""
                    stats["temperature_implausible_other"] += 1
                else:
                    flag, valid = "valid_raw_measurement", r["temp_c"]
                    stats["temperature_valid_numeric"] += 1
                if tw: tw.writerow({
                    "facility_id": facility, "recorded_at": when,
                    "temp_c_raw": r["temp_c"], "temp_c_validated": valid, "quality_flag": flag})
                if t is not None:
                    prev = previous.get(facility)
                    if prev is not None:
                        hours = (t - prev).total_seconds() / 3600
                        if hours > 1.01:
                            missing = max(0, round(hours) - 1)
                            stats["monitoring_gap_intervals"] += 1
                            stats["missing_expected_hourly_records"] += missing
                            if gw: gw.writerow({
                                "facility_id": facility, "after_reading": prev.strftime(TIME),
                                "before_reading": when, "missing_expected_hourly_records": missing})
                        elif hours < .99:
                            stats["temperature_duplicate_or_unordered_timestamps"] += 1
                    previous[facility] = t
        finally:
            if temp_file: temp_file.close()
            if gap_file: gap_file.close()
        report = {
            "scope": "Terumo BCT Africa Hackathon 2026; organizer synthetic starter data only",
            "logic": "Source values preserved; stable-ID facility names normalized; sensor glitches flagged and invalidated in validated column, raw retained; gaps NOT filled; candidate donor identities NOT merged; missing blood groups NOT inferred.",
            "time_basis": "East Africa Time (UTC+3), source clock values",
            "reference": "DATA_DICTIONARY.md inside starter ZIP",
            "facility_reference_records": len(facility_names),
            "summary": dict(sorted(stats.items())),
            "examples": examples,
            "limitations": [
                "Name differences include abbreviations/case, not necessarily misspellings.",
                "Candidate donor duplicates cannot be merged without human identity verification.",
                "Temperature data is facility-level, without named-fridge-to-unit history.",
                "RBC/whole-blood 2-6C rules must not be blindly applied to other components.",
                "Every result here is synthetic, not a statistic about real Kenyan facilities.",
            ]
        }
        (out / "quality_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return report

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--report-only", action="store_true")
    args = p.parse_args()
    print(json.dumps(perform(args.source, args.out, args.report_only)["summary"], indent=2))
