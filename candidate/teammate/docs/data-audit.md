# Starter dataset audit — Milestone 1

**Source:** Terumo BCT Africa Hackathon 2026 synthetic starter dataset.  
**Coverage:** 1 November 2025 to 31 October 2026.  
**Important:** These are findings in the supplied synthetic dataset, not facts about real facilities or patients.

## Files inspected

The archive contains 11 CSV files: facilities, routes, donors, drives, donations, units, transfers, requests, daily stock, power outages and temperature logs. It also contains `README.md`, `DATA_DICTIONARY.md`, `README_TEMPLATE.md`, `gen.py`, `index.html` and `logos.png`. The README mentions `blood_system.sqlite`, but that database file is not present in the uploaded archive.

## Verified table sizes

| File | Rows |
|---|---:|
| facilities.csv | 47 |
| temperature_logs.csv | 399,280 |
| units.csv | 49,426 |
| transfers.csv | 35,181 |
| power_outages.csv | 2,609 |
| requests.csv | 17,430 |
| daily_stock.csv | 185,785 |
| donations.csv | 47,363 |
| donors.csv | 43,363 |
| drives.csv | 1,091 |
| routes.csv | 2,162 |

## Temperature data validation

| Check | Result |
|---|---:|
| Raw temperature rows | 399,280 |
| Known sentinel glitches | 55 |
| Exact duplicate facility/timestamp rows | 0 |
| Conflicting duplicate timestamps | 0 |
| Usable readings after excluding sentinel glitches | 399,225 |
| Expected hourly readings (47 facilities × 8,760 hours) | 411,720 |
| Estimated missing hourly readings | 12,440 |
| Readings above 6°C | 4,607 |
| Readings below 2°C (excluding sentinel values) | 0 |

The sentinel values are `-99.0`, `99.9` and `0.0`. They are treated as known logger glitches, not genuine temperature excursions.

## Event grouping

- 1,933 contiguous out-of-range episodes were identified.
- 1,573 are short warning episodes.
- 360 meet the prototype's sustained-event escalation rule: four consecutive hourly readings above 6°C.

The four-reading rule is aligned with the starter generator's logic for marking an excursion day. It is an implementation choice for this synthetic dataset, not a universal clinical rule. A blood-service expert must validate operational thresholds and escalation timing.

## Unit traceability

- 81,149 confirmed/known unit-location intervals were reconstructed.
- 7,823 incident-to-unit overlap records were generated.
- 6,396 unique RBC/WB units were flagged as potentially affected candidates.
- 752 distinct incidents overlap at least one recorded power outage.

Location reconstruction uses `tested_date` as the earliest available processing proxy for new stock, the recorded `current_facility_id` for opening stock at 1 November 2025, and confirmed transfer receipt timestamps to establish destination arrival. Missing `received_at` values create an unknown-location period after dispatch. Date-only status values are treated as valid through the end of the recorded day.

The `temp_excursion_exposed` unit field is retained only as an evaluation reference in the processed CSV. It is not used to detect incidents, construct matches, or shown by the API. It includes exposure from fridge events and cool-box transfers, so it is not a direct ground-truth label for fridge-only matching.

## Known limitations

- Temperature logs have facility and timestamp fields but no fridge/device identifier.
- Hourly data gives approximate incident boundaries.
- Unit processing/release timestamps are not supplied; `tested_date` is a proxy.
- The first traceability workflow is limited to RBC and WB under the 2–6°C range documented by the dataset. Other components need their own validated rules.
- An overlap is an investigation candidate, not proof that a unit is unsafe.
- The system does not determine compatibility, release, discard, quarantine removal or transfusion.
