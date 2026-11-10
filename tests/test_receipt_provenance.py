import csv
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "receipt_provenance_audit.py"
spec = importlib.util.spec_from_file_location("receipt_provenance_audit", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def csv_content(rows):
    f = io.StringIO()
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
    return f.getvalue()

class ReceiptEvidenceTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.path = Path(tmp.name) / "fixture.zip"
        with ZipFile(self.path,"w") as z:
            z.writestr("gen.py", "received_at=None if rng.random() < 0.03 else rec\nunits[ui][\"current_facility_id\"] = dst\n")
            z.writestr("transfers.csv", csv_content([
                dict(transfer_id="TRF-005463",unit_id="TEST-001",from_facility_id="SRC",to_facility_id="DEST",transfer_type="routine",request_id="",dispatched_at="2026-01-01 09:00:00",received_at="",transport_mode="vehicle",coolbox_max_temp_c="4.9"),
                dict(transfer_id="TRF-000002",unit_id="TEST-002",from_facility_id="SRC",to_facility_id="DEST",transfer_type="routine",request_id="",dispatched_at="2026-01-01 10:00:00",received_at="2026-01-01 11:00:00",transport_mode="vehicle",coolbox_max_temp_c="4.7")
            ]))
            z.writestr("units.csv", csv_content([
                dict(unit_id="TEST-001",component="RBC",current_facility_id="DEST",status="transfused",status_date="2026-01-02",temp_excursion_exposed="False"),
                dict(unit_id="TEST-002",component="RBC",current_facility_id="DEST",status="in_stock",status_date="2026-01-01",temp_excursion_exposed="False")
            ]))

    def test_blank_receipt_is_documentation_gap_not_asserted_non_delivery(self):
        result=mod.audit(self.path)
        self.assertTrue(result["source_generator_confirms_random_missing_receipt"])
        self.assertEqual(result["total_transfers"],2)
        self.assertEqual(result["receipt_timestamp_blank"],1)
        self.assertEqual(result["unique_unit_ids_for_blank_receipts"],1)
        self.assertEqual(result["retrospective_unit_status_when_receipt_blank"]["transfused"],1)
        self.assertEqual(result["recorded_trips_above_dictionary_10c_threshold"],0)
        self.assertEqual(result["example_transfer"]["received_at"],"")
        self.assertIn("does not prove no physical delivery",result["decision"]["cannot_infer"])
        self.assertIn("cannot be decided",result["decision"]["no_automatic_hold"])

    def test_source_code_traceable_mechanism_not_assumed_after_change(self):
        with ZipFile(self.path,"a") as z:
            z.writestr("gen.py","not the original generation logic")
        # ZipFile will use last duplicate name, so the report becomes explicitly uncertain.
        result=mod.audit(self.path)
        self.assertFalse(result["source_generator_confirms_random_missing_receipt"])
        self.assertIn("could not be confirmed",result["source_generator_mechanism"])

if __name__=="__main__":
    unittest.main()
