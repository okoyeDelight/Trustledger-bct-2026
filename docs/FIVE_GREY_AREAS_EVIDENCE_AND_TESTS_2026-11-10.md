# Five grey areas — closure ledger, tests and honest limits

**Team:** TrustLedger | **Date:** 10 Nov 2026 | **Sources:** organizer synthetic starter ZIP, source DATA_DICTIONARY, technical brief, kickoff audio transcript, WHO *Good Practices for Blood Establishments* (2025, Annex 4), and executable code/tests.

**Product direction remains:** One cold-chain/data-quality **evidence → investigation → documented review → mock issue restriction** workflow. It is **not** a full blood-bank management system or a clinical device. The implementation must not assert anything the starter data cannot prove.

## 1. “Which blood units were in the affected refrigerator?”

**Finding:** The starter's `temperature_logs.csv` contains `facility_id, recorded_at, temp_c`, not a named sensor/device ID nor time-varying device-to-unit occupancy. Historical named-fridge-to-unit exposure **cannot be reconstructed** from those columns. The source's `units.current_facility_id` is the last known destination, **not** evidence of occupancy at a historical time.

**Implemented:** `src/custody_fixtures.js` holds **explicitly added synthetic** device, entry and exit timestamps for DEMO units. `candidateUnitContext()` applies a reproducible timestamp-overlap filter against the actual incident interval. The UI identifies these as **FICTIONAL TIMED OCCUPANCY** and never as confirmed exposure. The engineering *data model* gap is addressed; actual clinical exposure remains **UNVERIFIED** until a real facility provides equipment IDs, time-stamped unit movement records and logger attribution.

**Test:** Node `candidate units overlap...`, plus Playwright `candidate units are from time-bounded fictional custody...`. Refuse the shortcut “all units currently at facility were in the affected fridge.”

## 2. “What would a qualified blood-bank reviewer really do?”

**Grounding:** The official brief demands a person who Accepts/Changes/Rejects; AI must not authorize transfusion, compatibility, lab-result overrides or release from quarantine. WHO Annex 4 (2025) calls for documented deviations, impact investigation, designated authorization and computerized controls preventing release of unacceptable components (in particular §§1.6, 4.2.24, 6.8).

**Implemented:** Operator and quality reviewer are **SIMULATED roles** with mandatory rationales and an audit. A flagged case cannot be mock-cleared. Source power context now joins `power_outages.csv`: `OUT-00009`, RBTC-NBO, 5 Oct 22:18:42–6 Oct 02:08:39 EAT (3.83 hours; backup not engaged), overlapping actual temperature readings up to 7.9°C. This supports *temporal concurrence*, not proven causation or named-unit exposure.

**Open (cannot be closed responsibly with the dataset):** The exact site SOP, who holds legal authority to disposition a unit, required independent evidence (equipment calibration, continuous logger, location records), and regulatory validation. The app has **no authenticated staff access** and **cannot make clinical decisions**. Requires a blood-service practitioner's confirmation and production security.

## 3. “Does this outperform a competent conventional monitor?”

**Honest answer:** Not in detection on the four curated cases. Competent gap/threshold/sentinel rules and our evidence inspection both identify 4/4. A naive latest-reading-only baseline identifies 1/4. No ML model or independent clinical validation was claimed.

**Improvement:** Added whole-year *descriptive* gap analysis from `scripts/system_pressure.py`: **387** synthetic facility monitoring gaps, **381** followed by an in-range 2–6°C reading, **375** with both boundary readings in range, **12,273** missing expected hourly measurements. This shows the scale of **latest-reading-only blind spots**, not superiority over good conventional monitoring.

**Differentiation hypothesis:** Staff may benefit from evidence provenance, optional corroborating context, documented reviewer sign-off, tracked restriction and explicit uncertainty. It is **not proven** to cut investigation time, losses, patient injury or review errors. No fabricated speed/accuracy gains are used.

**Test:** Source pressure data script plus fixture-based Python unit tests; browser asserts that the full-year counts are distinct from the four-case benchmark.

## 4. “Can staff resolve a case, or does the tool just keep holding stock forever?”

**Implemented:** A reviewed incomplete/abnormal case can now **document a completed administrative review with continued restriction** or **refer to site authority**, with recorded supporting evidence and next steps. Both transitions are in `closeReview`, logged in the local audit, and **still blocked by the mock issue guard**. A clean negative control may be mock-permitted after review, with explicit “not clinical release” wording.

**Critically open:** The source provides no real proof that an anomalous fridge/monitoring interval has been clinically cleared. Administratively closing an incident does **not** prove the unit is safe, nor should it release blood. A future genuine resolution needs independent calibrated measurements, validated device/location linkage, and qualified sign-off under a locally validated SOP. Adding a fake “safe now” button would be dangerous and dishonest.

**Test:** Engine and end-to-end browser journeys verify administrative closure, audit entry and continued mock block after closure. No indefinite unlabeled pending state: a responsible action and follow-up are recorded.

## 5. “Is the entire data-quality analysis actually connected to the product?”

**Previously:** Four source-backed, **hand-transcribed** temperature excerpts in `src/engine.js`; a separate full-data Python cleaning pipeline; no runtime cross-file context.

**Implemented now:** `scripts/build_source_evidence.py` reconstructs selected case excerpts from **exact source CSV rows** using required `(facility_id, recorded_at)` keys. It fails if any required source reading is absent or duplicated, and joins overlapping source `power_outages.csv` records. The app imports its generated `src/source_evidence.js`, so the *same* underlying source observations drive detection, charts and human-review workflow. `src/custody_fixtures.js` is an explicitly separate input. `scripts/audit_starter.py` still provides a reproducible complete synthetic cleaning report, visible in Evidence Lab. Browser offline shell caches both modules.

**Remaining limitation:** This is a **source-generated static demonstration**, not a live ingestion/cleaning service, nor a backend with durable multi-site sync. The runtime uses curated source excerpts, and the full 399,280-row audit remains batch/CLI. Do **not** claim continuous automated production ETL or that every facility is onboarded.

**Tests:** Python extraction tests, Node original-source-field/temporal-overlap tests, and desktop/mobile Playwright interactive tests.

## Why we're not adding extra clinical features now
The cutoff is Wed 11 Nov 12:00 EAT / 10:00 WAT. Hany asked for **one working workflow** and said the short demo video may be judges' first touch. The repo must be public by final submission. It is more valuable to finish hosted access and a reproducible 3-minute journey than add unrelated donor forecasting, national redistribution, compatibility calculations, SMS or an unverified hospital API.

## Exact remaining gates (not silently marked complete)
1. **Professional/site validation:** named reviewer and facility SOP confirming required equipment/unit evidence and qualified disposition. This is not in the starter ZIP, and no answer from a practitioner is verified.
2. **True role authorization:** authenticated, server-enforced, traceable control would be required to interact with real inventory; current app is explicitly simulated, with a browser-local editable audit.
3. **Prospective evaluation:** fair comparison of reviewer-task outcomes against a competent monitor+manual incident ticket, with honest measured data and a real user; not available yet.
4. **Production data integrity:** persistent backend, device clocks/calibration, backup, cross-device sync, information governance and disaster recovery not implemented.
5. **Judging deliverables:** public judge-accessible HTTPS app, public README/repo, 3-min video, up to 8 slides, source-backed baseline, architecture, roster confirmation and check-ins.

**Bottom line:** We've closed the *prototype engineering and evidence-handling* ambiguities where we can. We have **not** closed real clinical/operational governance and will not claim otherwise.
