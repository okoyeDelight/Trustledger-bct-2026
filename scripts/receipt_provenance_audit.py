#!/usr/bin/env python3
"""Audit the source-backed transfer receipt-gap challenger to TrustLedger.

This is a DATA-COMPLETENESS signal, not proof of an undelivered or unsafe unit.
The organizer's synthetic gen.py deliberately blanks receipt timestamps on
~3% of transfers AFTER computing an arrival time and still updates the unit's
destination. The retrospective "transfused" flag cannot be treated as an
at-decision-time predictor or independent evidence of physical receipt.

Usage:
    python3 scripts/receipt_provenance_audit.py --source '/path/to/Hackathon Starter Dataset.zip'
"""
import argparse
import csv
import io
import json
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

EXAMPLE_TRANSFER_ID = "TRF-005463"
def table(z, file):
    with z.open(file) as blob, io.TextIOWrapper(blob, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)

def audit(archive):
    with ZipFile(archive) as z:
        gen = z.read("gen.py").decode("utf-8-sig")
        generator_verified = (
            "received_at=None if rng.random() < 0.03 else rec" in gen
            and 'units[ui]["current_facility_id"] = dst' in gen
        )
        units = {u["unit_id"]: u for u in table(z, "units.csv")}
        missing = []
        missing_types = Counter()
        statuses = Counter()
        all_count = 0
        above_ten = 0
        maximum = None
        for transfer in table(z, "transfers.csv"):
            all_count += 1
            try:
                temperature = float(transfer["coolbox_max_temp_c"])
                maximum = temperature if maximum is None else max(maximum, temperature)
                if temperature > 10: above_ten += 1
            except (ValueError, TypeError):
                pass
            if not transfer["received_at"]:
                missing.append(transfer)
                missing_types[transfer["transfer_type"]] += 1
                u = units.get(transfer["unit_id"])
                statuses[(u or {}).get("status","missing_unit_record")] += 1
        example = next((t for t in missing if t["transfer_id"] == EXAMPLE_TRANSFER_ID), None)
        if example is None:
            raise ValueError("Named original transfer example not found; dataset format changed")
        unit = units.get(example["unit_id"])
        if unit is None:
            raise ValueError("Referenced synthetic unit missing")
        return {
            "scope": "Organizer-provided SYNTHETIC transfer and unit records, not real healthcare evidence",
            "method": "Direct left join of transfers.csv.unit_id to units.csv.unit_id; blank received_at check; source generator logic inspected",
            "source_generator_confirms_random_missing_receipt": generator_verified,
            "source_generator_mechanism": (
                "gen.py creates arrival time, randomly omits received_at with 3% probability, and updates unit destination irrespective of that omission"
                if generator_verified else "generator structure could not be confirmed; do not infer mechanism"
            ),
            "total_transfers": all_count,
            "receipt_timestamp_blank": len(missing),
            "receipt_blank_percent": round(100 * len(missing) / all_count, 2) if all_count else None,
            "unique_unit_ids_for_blank_receipts": len({x["unit_id"] for x in missing}),
            "transfer_types_with_blank_receipts": dict(sorted(missing_types.items())),
            "retrospective_unit_status_when_receipt_blank": dict(sorted(statuses.items())),
            "observed_max_trip_temp_c": maximum,
            "recorded_trips_above_dictionary_10c_threshold": above_ten,
            "example_transfer": example,
            "example_retrospective_unit": {
                key: unit[key] for key in
                ["unit_id","component","current_facility_id","status","status_date","temp_excursion_exposed"]
            },
            "decision": {
                "reconcile":"Missing receipt timestamp warrants a documentation review and possible correction by the responsible staff",
                "cannot_infer":"Missing source receipt does not prove no physical delivery, a cold chain excursion, clinical rule violation or patient harm",
                "no_automatic_hold":"Clinical quarantine or release cannot be decided solely from a blank received_at without facility SOP and qualified personnel",
                "do_not_use_later_outcome":"units.csv.status is a retrospective outcome, not available to prospective transfer receipt validation",
            }
        }

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True, type=Path)
    p.add_argument("--out", type=Path, default=None)
    args = p.parse_args()
    result = json.dumps(audit(args.source), indent=2)+"\n"
    if args.out:
        args.out.parent.mkdir(exist_ok=True, parents=True)
        args.out.write_text(result, encoding="utf-8")
    print(result)
