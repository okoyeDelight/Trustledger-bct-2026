import csv
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

MOD = Path(__file__).resolve().parents[1] / "scripts" / "audit_starter.py"
spec = importlib.util.spec_from_file_location("audit_starter", MOD)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

def csv_text(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()

class DataQualityAuditTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name)
        self.archive = self.folder / "fixture.zip"
        tables = {
            "facilities.csv": [dict(facility_id="HSP-024", name="Narok County Referral Hospital")],
            "requests.csv": [
                dict(request_id="REQ-A", facility_id="HSP-024", facility_name_raw="NAROK CRH", patient_blood_group="unknown"),
                dict(request_id="REQ-B", facility_id="HSP-024", facility_name_raw="Narok County Referral Hospital", patient_blood_group="O+")
            ],
            "donors.csv": [
                dict(donor_id="D1", birth_date="2000-01-01", sex="F", home_county="Narok", phone_last4="1234", blood_group=""),
                dict(donor_id="D2", birth_date="2000-01-01", sex="F", home_county="Narok", phone_last4="1234", blood_group="O+")
            ],
            "temperature_logs.csv": [
                dict(facility_id="HSP-024", recorded_at="2026-10-01 00:00:00", temp_c="4.0"),
                dict(facility_id="HSP-024", recorded_at="2026-10-01 03:00:00", temp_c="99.9"),
                dict(facility_id="HSP-024", recorded_at="2026-10-01 04:00:00", temp_c="4.2"),
                dict(facility_id="HSP-024", recorded_at="2026-10-01 05:00:00", temp_c="0.0")
            ],
        }
        with ZipFile(self.archive, "w") as z:
            z.writestr("DATA_DICTIONARY.md", "Sensor glitches: -99.0, 99.9 and 0.0")
            for path, rows in tables.items(): z.writestr(path, csv_text(rows))

    def test_raw_values_preserved_and_named_id_join_is_canonical(self):
        result = audit.perform(self.archive, self.folder / "out")
        summary = result["summary"]
        self.assertEqual(summary["requests_names_differ_from_canonical"], 1)
        with (self.folder / "out" / "requests_reconciled.csv").open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(rows[0]["facility_name_raw"], "NAROK CRH")
        self.assertEqual(rows[0]["facility_name_canonical"], "Narok County Referral Hospital")
        self.assertEqual(summary["requests_patient_group_missing_or_unknown"], 1)

    def test_zero_and_99_point_9_are_glitches_not_recorded_excursions(self):
        result = audit.perform(self.archive, self.folder / "out")
        summary = result["summary"]
        self.assertEqual(summary["temperature_sentinel_glitches"], 2)
        self.assertEqual(summary["monitoring_gap_intervals"], 1)
        self.assertEqual(summary["missing_expected_hourly_records"], 2)
        with (self.folder / "out" / "temperature_validated.csv").open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows[1]["temp_c_raw"], "99.9")
        self.assertEqual(rows[1]["temp_c_validated"], "")
        self.assertEqual(rows[3]["temp_c_raw"], "0.0")
        self.assertEqual(rows[3]["temp_c_validated"], "")
        with (self.folder / "out" / "missing_temperature_intervals.csv").open() as f:
            gaps = list(csv.DictReader(f))
        self.assertEqual(gaps[0]["missing_expected_hourly_records"], "2")

    def test_donor_candidates_not_merged_and_groups_not_inferred(self):
        result = audit.perform(self.archive, self.folder / "out")
        s = result["summary"]
        self.assertEqual(s["donor_records"], 2)
        self.assertEqual(s["candidate_duplicate_donor_groups"], 1)
        self.assertEqual(s["candidate_duplicate_extra_records"], 1)
        self.assertEqual(s["donor_group_missing_or_unknown"], 1)

    def test_report_only_does_not_export_derived_rows(self):
        audit.perform(self.archive, self.folder / "report", report_only=True)
        self.assertTrue((self.folder / "report" / "quality_report.json").exists())
        self.assertFalse((self.folder / "report" / "temperature_validated.csv").exists())

if __name__ == "__main__":
    unittest.main()
