# Data quality is part of the TrustLedger product, not an incidental cleanup

**Grounded in actual kickoff audio:** In the 10 Nov 2026 meeting at ~22:38–23:12, Hany explicitly stated that the intentionally messy synthetic data includes duplicate donors, missing blood groups, misspelled facility names and sensor glitches; cleaning these counts as hackathon work. This does **not** mean every team is required to auto-correct every field. We prioritize cleaning with a safety reason that fits our cold-chain/data-quality challenge.

## What has now actually been implemented

Run `scripts/audit_starter.py` against the **original** synthetic dataset ZIP to:
1. Preserve raw typed request facility names while adding a canonical name obtained by **verified facility_id**. The cleaned field is deterministic and traceable; discrepancies that are merely capitalization or abbreviation are not labelled necessarily wrong.
2. Preserve raw temperature values, but leave `temp_c_validated` blank and mark `quality_flag=documented_sensor_glitch` for source-dictionary sentinels **-99.0, 99.9 and 0.0**. This avoids false clinical certainty, but it does **not** reconstruct actual fridge temperatures.
3. Enumerate gaps between recorded consecutive facility-hours as **missing evidence**. They are not silently filled or interpolated.
4. Flag donor records with missing/unknown blood groups; produce **candidate-only** duplicate pairs using birth date, sex, home county and synthetic last-four phone digits, without auto-merging two possible people.
5. Flag missing/unknown blood groups in requests, without inventing missing results.
6. Export a JSON audit report with counts and selected examples; optionally export `requests_reconciled.csv`, `temperature_validated.csv`, `missing_temperature_intervals.csv`. Outputs are derived synthetic files, not real donor/patient information.

**Safety distinction:** Cleansing data quality is NOT equivalent to authorizing blood for transfusion. Only verified clinical SOP and qualified people can decide actual unit disposition. The starter dataset has no historical named fridge-to-unit relationship.

## Full original starter ZIP audit (10 Nov 2026)

| Measure | Observed count | Treatment |
|---|---:|---|
| Temperature records read | 399,280 | Original preserved |
| Explicit sensor-glitch sentinels | **55** (17 × -99, 16 × 99.9, 22 × 0) | Flag and exclude from `validated`, preserve raw |
| Monitoring gaps between consecutive readings | **387** | Generate interval list for review |
| Missing expected hourly readings within those gaps | **12,273** | Mark unknown; NEVER fabricate temperature |
| Request rows examined | 17,430 | Original preserved |
| Raw facility names that differ exactly from canonical ID mapping | **1,852** | Join canonical display name by stable ID, preserve raw |
| Donor records examined | 43,363 | Original preserved |
| Donor group missing or unknown | **506** | Flag; do not impute |
| Requests with patient group missing/unknown | **442** | Flag; do not impute |
| Candidate duplicate donor groups | **452** groups of 2 = 904 records | Queue for human review, NEVER merge automatically |

All figures come from the script against the provided ZIP. `data/quality_audit_snapshot.json` records the full snapshot. The timestamp of readings uses EAT (+03:00), not WAT (+01:00).

**Do not inflate this into an independent clinical performance benchmark.** Name mismatches include *harmless* abbreviations/case; “duplicate candidates” are not established actual duplicates. Monitoring gap accounting uses only intervals between supplied readings, and does not count any boundary gaps outside them.

## Reproduce the cleaning

You need the organizer's `Hackathon Starter Dataset.zip` downloaded separately; the full archive is not committed to the repository.

```bash
# From repository root, no dependencies:
python3 scripts/audit_starter.py --source "/path/to/Hackathon Starter Dataset.zip" --out ./derived

# For light-weight report only:
python3 scripts/audit_starter.py --source "/path/to/Hackathon Starter Dataset.zip" --out ./derived --report-only

# Run fixture-based regression tests, no full archive required:
python3 -m unittest discover -s tests -p "test_audit_starter.py" -v
npm test
```

Inspect `derived/quality_report.json`, `derived/requests_reconciled.csv`, `derived/temperature_validated.csv`, and `derived/missing_temperature_intervals.csv`. These derived outputs are intentionally ignored from Git except for the small verified `data/quality_audit_snapshot.json`.

## How this strengthens our one workflow
The UI should first demonstrate the original `99.9` raw sentinel and the 57-hour monitoring gap, followed by the validated-vs-raw evidence distinction and staff review. The raw source rows and all uncertainty remain auditable. In the narrative, explain: **If messy monitoring data are silently misread as proof of fridge temperature, even a beautiful alert dashboard is unreliable.**

This counts as hands-on data processing work, is reproducible, and makes the human-in-the-loop demo defensible. It does not claim an AI model beats competent rules; that evaluation remains a separate requirement.
