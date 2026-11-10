import csv
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

MOD = Path(__file__).resolve().parents[1] / "scripts" / "build_source_evidence.py"
spec = importlib.util.spec_from_file_location("build_source_evidence", MOD)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

def write_csv(rows):
    s = io.StringIO()
    writer = csv.DictWriter(s, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return s.getvalue()

class SourceDossierTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.zipfile = Path(tmp.name) / "synthetic_fixture.zip"
        measurements = []
        for facility, stamps in builder.CASE_TIMES.values():
            for at in stamps:
                if not any(r["facility_id"] == facility and r["recorded_at"] == at for r in measurements):
                    measurements.append({"facility_id": facility, "recorded_at": at, "temp_c": "4.3"})
        outages = [
            {"outage_id":"OUT-00009", "facility_id":"RBTC-NBO",
             "start_time":"2026-10-05 22:18:42", "end_time":"2026-10-06 02:08:39",
             "duration_hours":"3.83", "backup_power_engaged":"False"}
        ]
        with ZipFile(self.zipfile,"w") as z:
            z.writestr("temperature_logs.csv",write_csv(measurements))
            z.writestr("power_outages.csv",write_csv(outages))

    def test_exact_source_extraction_and_independent_outage_join(self):
        cases = builder.extract(self.zipfile)
        self.assertEqual(len(cases),4)
        self.assertEqual(cases["TL-NBO-HOT"]["overlapping_power_outages"][0]["outage_id"],"OUT-00009")
        self.assertEqual(cases["TL-NBO-HOT"]["overlapping_power_outages"][0]["backup_power_engaged"],False)
        self.assertEqual(cases["TL-024"]["overlapping_power_outages"],[])
        self.assertEqual(cases["TL-024"]["source_readings"][0]["source"],"starter:temperature_logs.csv")
        self.assertEqual(cases["TL-024"]["source_readings"][0]["at"],"2026-09-30T07:00:00+03:00")
        self.assertIn("NO named fridge-to-unit history",cases["TL-024"]["exposure_provenance"])
        self.assertIn("export const EVIDENCE_CASES",builder.render(cases))

    def test_missing_requested_csv_row_fails_closed(self):
        # Rebuild ZIP without one of the required timestamps.
        with ZipFile(self.zipfile) as z:
            stream = io.StringIO(z.read("temperature_logs.csv").decode())
            rows = list(csv.DictReader(stream))
            outs = z.read("power_outages.csv")
        rows = rows[1:]
        with ZipFile(self.zipfile,"w") as z:
            z.writestr("temperature_logs.csv",write_csv(rows))
            z.writestr("power_outages.csv",outs)
        with self.assertRaisesRegex(ValueError, "Source rows missing"):
            builder.extract(self.zipfile)

if __name__ == "__main__":
    unittest.main()
