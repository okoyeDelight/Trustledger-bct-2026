# TrustLedger — submission evidence map
**November 11, 2026 · Synthetic hackathon demonstration · Not clinically validated**

## One-sentence value claim
TrustLedger converts noisy blood cold-chain monitoring records into evidence-linked investigation candidates and records an accountable worker-to-supervisor response, without inventing storage-device identity or authorizing clinical blood-unit decisions.

## What is executable and verifiable today

| Claim | Exact proof | Honest limitation |
|---|---|---|
| Detect out-of-range episodes and data-quality problems | Production pipeline `backend/app/services/pipeline.py`, pinned six synthetic source CSVs; `/api/dashboard` and `/api/incidents` | Static build-time processing, not live sensor integration |
| Unknown data remain unknown | `/proof-lab`: 57 missing hourly readings while latest sample is 4.0°C | An adequate conventional gap monitor would also detect the gap |
| Missing transfer receipt does not establish arrival | `/proof-lab`: custody reconstruction uses `build_location_intervals` | Facility-level matching, no device-specific claim |
| Known sentinel is excluded as a measurement | `/proof-lab`: 99.9°C flagged by `validate_temperature` and excluded from excursion detection | Other unexpected values and site-specific QA need clinical validation |
| Each incident links evidence and human action | Any `/incidents/{id}` screen: **Evidence Passport**, source timestamp samples, candidate units, investigation notes, event timeline | Not an independently certified cryptographic audit or patient-level record |
| Two different people approve administrative workflow | Worker writes finding and submits; supervisor reviews, assigns action; worker completes; supervisor closes | Environment-provisioned demo identities, not institutional MFA or facility-scoped authorization |
| Versioned external contract rejects invalid messages | `/proof-lab` import validator, `POST /api/proof-lab/validate-import`; required timezone and field checks | Validation only: no ingestion, no live ABBIS/HL7/FHIR integration |
| Code and data steps are reproducible | `backend/tests` including `test_proof_lab.py`, GitHub CI, pinned source hashes in fetch script | No hospital field validation or independent clinical expert endorsement |

## Fair comparator
- Latest-reading-only interface: a deliberately naive teaching illustration, *not a credible alternative system*.
- A competent conventional monitor: detects missing readings, sentinel sensor failures and receipt-dependent unit custody too. **TrustLedger does not claim to outperform it on detection.**
- Proposed contribution: incident-to-source traceability, explicit uncertainty, persistent independent human-review history in one workflow.
- The three Proof Lab scenarios are hand-designed demonstrations; **not a statistical performance study**. The retrospective benchmark in the dashboard uses synthetic evaluation labels and is not held out. Do not imply independently validated prediction accuracy.

## End-to-end event path
Pinned synthetic source → parsing / quality audit → provisional incident candidate → facility-level candidate unit association → Evidence Passport → authenticated worker finding and investigation submission → independently signed supervisor assessment → assigned action → worker completion → administrative closure → append-only case event history.

The human investigation can also start as a staff report with no source telemetry; such reports are clearly labeled uncorroborated.

## Evidence caveats to say aloud
- 2–6°C band and four consecutive readings above 6°C are **prototype policy choices requiring expert verification**, not universal clinical disposition rules.
- The pipeline does not know individual refrigerator occupancy or a donor/patient's disposition.
- A power-outage overlap is correlation only; a candidate unit is not a verified exposed unit.
- Records come from organizer-supplied synthetic source data.
- No **live** external system is connected. Versioned import schema is a design contract only.
- Offline cached data can be stale; new clinical, reviewer and follow-up actions are not saved offline.
- Demo staff credentials are not production identity or site-isolated authorization.
- Any future clinical deployment requires partner consent, professional SOP validation, managed authentication, site scoping, device/unit traceability, security review, audit-retention policy and independently validated evaluation.
- Original teammate-source subtree has no declared license. Obtain express redistribution/submission permission before publishing or packaging that material.

## The pitch in one sentence
**A normal monitor can tell you a temperature is abnormal. TrustLedger helps establish what was actually observed, what is uncertain, which records require investigation, and who investigated and reviewed them.**

## Submission links
- Official application: https://trustledger-bct-2026.vercel.app
- Final demo route: https://trustledger-bct-2026.vercel.app/proof-lab (available after release of this branch)
- Private source repository: https://github.com/okoyeDelight/Trustledger-bct-2026
- Test cases: `backend/tests/test_proof_lab.py` and `backend/tests/test_two_account_api.py`
- Three-minute demonstration: `submission/DEMO_SCRIPT_FINAL_2026.md`
