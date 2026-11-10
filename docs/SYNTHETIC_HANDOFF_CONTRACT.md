# Synthetic incident handoff contract — export only

**Implemented:** a local browser JSON download for a selected TrustLedger case. **NOT implemented:** a live hospital BBIS API, FHIR endpoint, interoperable national messaging standard, authenticated staff identity, clinical release, secure transport, or signed audit trail.

## What the actual software exports

Schema tag: `trustledger.synthetic-handoff.v1`. Created by `src/engine.js::buildHandoffPacket(state, caseId)`; downloaded by `src/app.js` when the user selects **Download demo handoff JSON**.

| JSON field | Semantics |
|---|---|
| `schema` | Version label for this demo-specific format; **not** FHIR or any published standard |
| `classification` | `SYNTHETIC_DEMO_ONLY_NOT_FOR_CLINICAL_USE` |
| `generated_at` | Date/time of browser export |
| `source_case` | Case ID, facility ID, source component and title |
| `evidence.source_granularity` | `FACILITY_LEVEL_NOT_NAMED_EQUIPMENT` |
| `evidence.raw_source_readings` | Original synthetically generated facility-level readings with timestamps and per-record source tags |
| `evidence.overlapping_power_outages` | Related original power-outage table entries, where available; temporal overlap does not prove causation |
| `evidence.findings` | Deterministic gap, observed excursion and sentinel flags, with missing-hour counts and certainty |
| `candidate_inventory` | **Only added fictional custody records** and `confirmed_unit_exposure: false` |
| `simulated_review` | Operator proposal and reviewer decision/reasons, `role_identity_verified: false` |
| `simulated_issue_control` | Test gate state, issue attempts and **`clinical_release_authorized: false`** |
| `integration_status` | `EXPORT_ONLY_NO_EXTERNAL_SYSTEM_CONNECTED` |

The demo accepts **no real donor, patient, staff or hospital records**. Reviewer comments are entered in one browser and are not verified identity data. Exporting the packet does not write to an inventory system, send an alert, authorize a clinical release, or automatically resolve a missing temperature record.

## How judges can verify

1. Start the web prototype and choose TL-024.
2. Inspect the 57 missing expected hourly samples. Try the mock issue action and observe a block.
3. Record a simulated operator proposal and reviewer outcome; optionally document site-authority referral.
4. Click **Download demo handoff JSON**.
5. Open the file: confirm source facility readings, `missing_expected_hourly_records: 57`, explicit fictional unit provenance, false clinical-release authorization, and export-only integration status.
6. Select TL-NBO-HOT and repeat; `OUT-00009` appears as independent power-source context.

Automated verification: `tests/engine.test.mjs` (packet fidelity and refusal to claim unit exposure or clinical release); `e2e/core.spec.mjs` (real browser-download contents on desktop, mobile and small mobile viewport).

## Path to real integration — future proposal only

- Confirm specific blood-service system and local facility SOP with its authorized owner.
- Obtain verifiable device IDs, unit movement timestamps and staff permissions.
- Define a validated canonical incident schema and a versioned authenticated adapter, e.g. an approved facility-specific API. Do not claim FHIR compliance until mappings and conformance are independently established.
- Apply server-side role permissions, device/user authorization and tamper-evident audit events.
- Implement idempotent retries, offline queue reconciliation, explicit conflict handling and security/privacy review.
- Pilot with qualified blood-service personnel, measuring investigation completeness, time to resolution and safety process adherence before making any saved-unit or clinical-outcome claim.

**This JSON export is an interoperability demonstration boundary, not a clinical integration.**
