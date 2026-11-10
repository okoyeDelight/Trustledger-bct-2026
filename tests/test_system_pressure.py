import csv
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

MOD = Path(__file__).resolve().parents[1] / "scripts" / "system_pressure.py"
spec = importlib.util.spec_from_file_location("system_pressure", MOD)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def csv_text(rows):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()

class SystemPressureTests(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        self.archive = Path(td.name) / "fixture.zip"
        with ZipFile(self.archive, "w") as z:
            tables = {
                "units": [
                    {"unit_id":"U1", "component":"RBC", "status":"expired", "temp_excursion_exposed":"False"},
                    {"unit_id":"U2", "component":"WB", "status":"discarded_temperature", "temp_excursion_exposed":"True"},
                    {"unit_id":"U3", "component":"PLT", "status":"transfused", "temp_excursion_exposed":"True"},
                    {"unit_id":"U4", "component":"RBC", "status":"transfused", "temp_excursion_exposed":"False"}
                ],
                "donors": [
                    {"donor_id":"D1","donor_category":"student"},
                    {"donor_id":"D2","donor_category":"general_public"}
                ],
                "requests": [
                    {"request_id":"R1","outcome":"fulfilled","urgency":"emergency","emergency_supplied_from_id":"C1",
                     "requested_at":"2026-01-01 00:00:00","last_unit_available_at":"2026-01-01 05:00:00"},
                    {"request_id":"R2","outcome":"partially_fulfilled","urgency":"routine","emergency_supplied_from_id":"",
                     "requested_at":"2026-01-01 00:00:00","last_unit_available_at":""}
                ],
                "temperature_logs": [
                    {"facility_id":"HSP-1","recorded_at":"2026-01-01 00:00:00","temp_c":"4"},
                    {"facility_id":"HSP-1","recorded_at":"2026-01-01 03:00:00","temp_c":"4.5"},
                    {"facility_id":"HSP-1","recorded_at":"2026-01-01 04:00:00","temp_c":"7"},
                    {"facility_id":"HSP-1","recorded_at":"2026-01-01 07:00:00","temp_c":"4.5"}
                ]
            }
            for name, rows in tables.items():
                z.writestr(name + ".csv", csv_text(rows))

    def test_synthetic_pressure_calculations(self):
        a = module.analyze(self.archive)
        self.assertEqual(a["rbc_and_whole_blood"]["total"],3)
        self.assertEqual(a["rbc_and_whole_blood"]["expired"],1)
        self.assertEqual(a["rbc_and_whole_blood"]["discarded_temperature"],1)
        self.assertEqual(a["rbc_and_whole_blood"]["wasted_total"],2)
        self.assertEqual(a["transfused_with_retrospective_exposure_flag_all_components"],1)
        self.assertEqual(a["donor_records"]["student"],1)
        self.assertEqual(a["hospital_requests"]["not_fully_fulfilled"],1)
        self.assertEqual(a["external_emergency_supply"]["median_request_to_last_unit_hours"],5.0)
        self.assertEqual(a["monitoring_gaps"]["intervals"],2)
        self.assertEqual(a["monitoring_gaps"]["missing_expected_hourly_records"],4)
        self.assertEqual(a["monitoring_gaps"]["next_reading_normal"],2)
        self.assertEqual(a["monitoring_gaps"]["both_boundary_readings_normal"],1)

if __name__ == "__main__":
    unittest.main()
