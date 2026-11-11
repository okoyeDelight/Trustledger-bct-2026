# TrustLedger — evidence-linked blood cold-chain incident investigation

**Current implementation (November 11, 2026):** The deployed application is a combined Next.js frontend (`frontend/`) and FastAPI backend (`backend/`) with Neon PostgreSQL append-only staff notes, reviews and case-history events. The official URL is **https://trustledger-bct-2026.vercel.app**. This is a **synthetic-data hackathon prototype**, not a clinical product or a real hospital-system integration.

**Core integration MVP (pending database approval):** A pinned synthetic ABBIS-like source produces four chronological observations through a genuine authenticated `POST /api/connectors/v1/observations` endpoint. Each reading is stored append-only in a dedicated connector ledger (migration `004_connector_observations.sql`), duplicate acknowledgements are idempotent, and a four-consecutive-hour provisional incident enters the existing review workflow. The authenticated `GET /api/connectors/v1/cases/{case_reference}` endpoint returns current investigation and review history. Source data were recorded historically and their timezone-less timestamps are **explicitly interpreted as UTC for the sandbox replay only**. The connection is live *software-to-software*, not live ABBIS or a clinical device. Requires migration 004 on Neon main before preview can ingest.

**Main product integration demo:** `/connections` sends a validated synthetic external temperature alert into a real incident and later reads its status. The optional hidden technical `/proof-lab` route offers three executable adverse-data challenges, honest comparisons with competent conventional rules, and a proposed schema-only external observation validator. The `/incidents/{id}` page has an Evidence Passport using actual underlying synthetic source records and the case's server-side review history.

- [Current evidence map and truth-in-claims table](docs/SUBMISSION_EVIDENCE_2026.md)
- [Final three-minute demonstration](submission/DEMO_SCRIPT_FINAL_2026.md)
- [Application release and Neon architecture](docs/CONSOLIDATED_RELEASE_GUIDE.md)
- [Automated verification](backend/tests/test_proof_lab.py)
- [Upstream source and author attribution](docs/CONSOLIDATION_SOURCE.md)

**Scope and limitations:** Facility-level observations and provisional unit matches cannot establish a refrigerator's identity, actual blood-unit exposure, causation, clinical suitability, release or transfusion authorization. Our current identity is demonstrator-only; external integrations and offline writes are not implemented. Case event history is database append-only to the restricted app role but has not undergone external audit certification. Prototype 2–6°C policy and four-hour rules need professional validation.

---

## Historical reference: original browser-only prototype

The remainder of this README documents the earlier static application (`index.html`, `src/`, and old demonstration scripts), which is retained for reproducibility and rollback. **Do not use its older localStorage claims, scenario counts or screenshots as evidence for the current deployment.**

# TrustLedger — Blood cold-chain exception-to-unit review

**Terumo BCT Africa Hackathon 2026 · Team TrustLedger · Challenge areas: Cold chain + Data quality**

> **Status: interactive browser prototype implemented, core decision rules passing automated tests; live deployment, broader data validation, expert review and end-user testing are still pending.** This is a hackathon prototype using synthetic data, NOT a clinically validated blood-bank system. Do not use it for real transfusion decisions.

## Judge verification — start here

**Run:** `python3 -m http.server 8080` then open `http://localhost:8080`. No credentials or live patient data. **Follow:** TL-024 (57 missing hourly records) → attempt blocked mock issue → operator proposal → simulated reviewer decision → documented investigation outcome → blocked issue again. TL-NBO-HOT adds independent source outage evidence and an observed 7.9°C facility-level excursion.

**[Full six-criterion evidence map](docs/JUDGING_EVIDENCE_MAP.md)** · **[Implemented architecture](docs/ARCHITECTURE_FOR_JUDGES.md)** · **[Source provenance](data/PROVENANCE.md)** · **[Demo script](submission/DEMO_SCRIPT_3_MIN.md)** · **[Eight-slide narrative](submission/PITCH_8_SLIDES.md)**.

| Official criteria (100 points) | Weight | Key verification |
|---|---:|---|
| Working end-to-end prototype | **25** | `src/app.js`, `src/engine.js`, Playwright |
| Technical depth/architecture | **20** | Fail-closed CSV extraction, state transitions, data-flow diagram |
| AI/data approach | **15** | Source-preserving cleanup, simple baseline 1/4 vs competent rules 4/4 and feature 4/4 (no superiority claimed) |
| Blood-system user/problem | **15** | Duty operator and QA reviewer, named SOP/traceability limits |
| African conditions/scale | **15** | Mobile responsive, local shell cache, offline-capable rules; not multi-device sync |
| Demo/readiness | **10** | Real-screen script/slide outline; recorded video and public demo still pending |

**Publication warning:** This *development* repository is private and its historical commits contain team-internal material. Do **not** change visibility to public without a privacy/history review and organizer guidance. A clean candidate public README and allowlisted bundle are staged under `submission/PUBLIC_README.md` and `scripts/build_judge_bundle.py`. The bundle preserves source code, not Git history.

### Synthetic incident handoff — an actual export, not a connected API

Every case now has a **Download demo handoff JSON** button. The generated `trustledger.synthetic-handoff.v1` record includes original facility-level temperature readings, overlapping source power outages, data-quality flags, separately labelled fictional candidate-unit custody, simulated operator/reviewer decisions and a mock issuing restriction. `src/engine.js::buildHandoffPacket` produces the packet with explicit `EXPORT_ONLY_NO_EXTERNAL_SYSTEM_CONNECTED` and `clinical_release_authorized: false`. A real blood-bank system has **not** been connected; the JSON is an integration-readiness illustration, not FHIR or a clinical standard. Unit and browser-download tests enforce these caveats.

## The problem
Our intended user is a blood-bank duty operator investigating a temperature excursion or a gap/implausible value in monitoring records, supported by an authorized quality reviewer. The hypothesis is that assembling reliable readings, power-outage context, possible affected inventory, and documented actions in one case can reduce missed evidence and incomplete reviews. **This precise frontline bottleneck has not yet been validated with a blood-service practitioner.**

The organizer's synthetic Kenya-inspired dataset contains 399,280 hourly facility-level temperature readings, 2,609 power-outage records, 49,426 units, and 35,181 transfers. It contains deliberately missing/implausible records. These are SIMULATED issues, not statistics about any real facility.

## What we built
- **Implemented:** responsive four-case cold-chain control room, source-backed evidence plots, 57-missing-hour detection, recorded synthetic excursions and sensor outlier preservation, candidate inventory fixture labels, operator proposal, separate *simulated* reviewer Accept/Change/Reject, persistent browser-local audit, a mock issue guard, evidence-backed outage context, explicitly invented timestamped custody fixtures, non-release investigation-closure records, benchmark screen and service-worker application-shell cache.
- **End-to-end demo:** choose HSP-024 → inspect normal latest readings but 57 missing hourly records → attempt mock issue (blocked) → submit a hold recommendation as operator → approve or change as simulated reviewer → re-attempt mock issue (still blocked, with a logged reason). Choose the clean control case to show that a separately reviewed mock issue can be allowed; this is NOT clinical release.
- **Tests:** [GitHub Actions](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/workflows/verify.yml) runs syntax checks and Node regression assertions across data gaps, excursions, glitches, baseline behavior, review and issue guard. The initial CI run passed. Tests are not a substitute for end-user or browser QA.
- **Not implemented:** authenticated reviewer identities, server/database, integration with hardware or a live blood system, patient/compatibility decisions, validated unit-to-fridge provenance, production-grade immutable audit, real offline synchronization, or clinical validation.
- **Demo video (≤3 minutes):** not recorded yet.
- **Public live demo:** not deployed yet. Browser demo has no login: two roles are simulated in one page.

## Five grey areas — our evidence-backed decision

The [five-grey-area review](docs/FIVE_GREY_AREAS_EVIDENCE_AND_TESTS_2026-11-10.md) distinguishes **prototype work completed** from issues that require real clinical-site evidence:

- **Unit traceability:** Time-bounded `DEMO-*` unit/device occupancy comes from **additional fictional fixtures** and is explicitly labelled. The original facility logs contain no device-to-unit history, so actual exposure remains unverified.
- **Clinical authority:** The operator, reviewer and issue desk are **browser simulations**, not authenticated clinical users. The official technical brief and WHO good-practice principles prohibit bypassing qualified review; a local SOP is required for real disposition.
- **Baseline:** The feature ties a competent gap-aware rules monitor on four curated cases (4/4 each). The whole synthetic year has 387 monitoring gaps, 381 followed by an in-range reading; descriptive evidence of a latest-reading blind spot, **not superior ML accuracy** or reduced patient harm.
- **Resolution vs restriction:** A reviewer can now close the *paperwork* with continued restriction or refer to site authority. That does not make abnormal evidence safe, and the simulated guard remains blocking. A separate clean negative control can be mock-permitted after review.
- **Data lineage:** `src/source_evidence.js` is reproducibly extracted from the real starter's exact CSV rows and independently joins `power_outages.csv`. Incident `TL-NBO-HOT` includes source outage `OUT-00009` (3.83 h, backup not engaged), overlapping measured 7.9°C. Cross-table coincidence is not proof of individual unit exposure.

Rebuild selected source observations with:
~~~bash
python3 scripts/build_source_evidence.py --source "/path/to/Hackathon Starter Dataset.zip"
python3 -m unittest discover -s tests -p "test_*.py" -v
npm test
~~~

**Still unverified:** actual blood-service SOP and expert user validation, clinical disposition proof, secure reviewer authentication, durable backend audit, an independent clinical outcome evaluation and production integration. No real blood is issued or released by this prototype.

## How to run it
No installation or API keys are needed. **Do not open index.html via the file:// scheme:** browser module loading requires an HTTP server.

~~~bash
git clone https://github.com/okoyeDelight/Trustledger-bct-2026.git
cd Trustledger-bct-2026
python3 -m http.server 8080
# Open http://localhost:8080/
~~~

For automated checks (Node.js 20+): \`npm test\`. The same tests and JavaScript syntax checks run automatically on pushes to \`main\`.

All four demonstration windows are generated from exact organizer temperature CSV rows into \`src/source_evidence.js\` by \`scripts/build_source_evidence.py\` (which also selects overlapping power-outage records); there is no runtime fetch of patient data, no external AI API and no database. Browser state is stored under a namespaced \`localStorage\` key. **Reset demo** clears local decisions but preserves source records. After one online visit the service worker attempts to cache the static application shell for re-opening offline; device-specific offline behavior still needs browser testing.

## Architecture
Actual implemented architecture (browser-only MVP, not the final clinical architecture):

~~~mermaid
flowchart LR
  Source["Original synthetic temperature_logs.csv + power_outages.csv"] --> Extract["scripts/build_source_evidence.py"]
  Extract --> Fixture["Generated src/source_evidence.js"]
  Extra["Explicitly invented timed custody (src/custody_fixtures.js)"] --> Fixture
  Fixture --> Rules["Evidence inspector: gaps, invalid values, observed excursions"]
  Rules --> View["Responsive control room + case detail"]
  View --> Operator["Simulated operator proposal"]
  Operator --> Reviewer["Simulated QA: Accept / Change / Reject"]
  Reviewer --> Guard["Mock issue guard"]
  Guard --> Audit["Browser-local decision log"]
  Audit --> Store["localStorage"]
  Cache["Service worker (shell cache)"] --> View
  Rules --> Eval["Comparison: latest-only / competent rules / evidence feature"]
~~~

Data source and invention boundary: [PROVENANCE.md](data/PROVENANCE.md). Source temperature and overlapping power-outage rows are facility-level and can establish temporal coincidence, not physical unit exposure or cause. Named-fridge and unit occupancy timelines come **only** from disclosed extra synthetic fixtures. This release does not use \`transfers.csv\` or real \`units.csv\` in clinical decisions; future import must preserve time and location uncertainty. Standards such as ISBT 128 and HL7 FHIR are integration ideas, not implemented compliance.

## Tested alternative — missing transfer receipts

We investigated a potentially stronger **unit-linked** case: 1,046 of 35,181 synthetic transfers have no `received_at`. Source generator `gen.py` confirms receipts are omitted randomly with a 3% probability **after the simulated arrival is calculated**. A missing receipt means **incomplete documentation, not non-delivery**. The 873 linked units later labelled `transfused` do not establish actual patient harm, a missing physical shipment, or the legality of an issue. No trip is recorded above the source's 10°C cool-box excursion threshold. Consequently we did **not** pivot to automatic clinical holds for missing receipts. We added a small, honest provenance comparison to Evidence Lab and retained our one cold-chain evidence-to-human-review workflow. See [reproducible receipt investigation](docs/MISSING_DATA_EXPERIMENT_AND_DECISION_2026-11-10.md) and [source audit](scripts/receipt_provenance_audit.py).

## Dataset cleanup: a reproducible part of the build

Hany explicitly clarified during the **10 Nov kickoff (~22:38–23:12)** that the synthetic dataset is deliberately messy and that cleaning it counts as hackathon work. We therefore implemented an independent, source-preserving **quality audit and cleaning script** (`scripts/audit_starter.py`), in addition to the interactive evidence inspector.

**Verified on the entire organizer-supplied synthetic ZIP:** 399,280 facility temperature records, including **55 documented sensor-glitch sentinels** (`-99.0`, `99.9`, and `0.0`); **387 monitoring gap intervals** containing **12,273 expected hourly readings not present**; and **1,852 raw request-facility names** that differ from the canonical name for their stable facility ID (some differences are harmless capitalization/abbreviation). The script also flags **506 donor records with missing/unknown blood groups**, **442 requests with missing/unknown patient groups**, and **452 candidate duplicate-donor pairs** without merging identities.

**Actual transformations:** keep raw data; use a verified facility ID to add a canonical display name, mark source-defined glitches as unknown in a separate validated-temperature column, and write explicit gap intervals. We **never invent readings or blood groups**, and duplicate candidates remain for human review. Counts are synthetic, not real Kenyan healthcare outcomes.

Reproduce with your own downloaded original starter ZIP (not committed here):

~~~bash
python3 scripts/audit_starter.py --source "/path/to/Hackathon Starter Dataset.zip" --out ./derived
python3 -m unittest discover -s tests -p "test_audit_starter.py" -v
~~~

Outputs: `derived/quality_report.json`, `derived/temperature_validated.csv`, `derived/missing_temperature_intervals.csv`, `derived/requests_reconciled.csv`. See [method and scope](docs/DATA_QUALITY_PIPELINE.md), [verified snapshot](data/quality_audit_snapshot.json), and the **Evidence Lab** view for the before/after explanation. This is a useful data-quality foundation, **not a claim of superior machine-learning accuracy or clinical validation**.

## AI and data
- **Implemented data feature:** deterministic evidence-quality analysis detects observed 2–6°C demo-band breaches, expected hourly monitoring gaps and obviously implausible raw values. It shows exact provenance, timestamps and the difference between an observed incident and an **unknown** monitoring interval. No trained ML model or LLM is needed for this critical function.
- **Baseline 1:** latest-value-only 2–6°C threshold alert. On four deliberately selected, manually annotated demonstration cases: **1/4 correct; 0/3 required-review cases detected**.
- **Baseline 2:** competent conventional rules (temperature threshold + missing interval + implausible value). On the *same four cases*: **4/4 correct; 3/3 required-review cases detected**.
- **TrustLedger data feature:** **4/4 correct; 3/3 required-review cases detected** on the *same four cases*. **It does not beat a competent rules baseline.** These are demo/smoke-test figures, NOT statistically independent clinical evaluation, and reflect no known patient benefit.
- **Human control:** operator proposes a hold, investigation or (only for the clean demo control) a mock clearance; a simulated quality reviewer independently Accepts/Changes/Rejects. Abnormal or incomplete evidence cannot be cleared by the app. No clinical inventory release/override is available.
- **Offline fallback:** evidence assessment and decision simulation are deterministic browser rules and do not depend on any cloud AI call. Application shell caching has been implemented but not verified on every target device. There is no secure cross-device synchronization.

## Data
Organizer-provided synthetic starter dataset (Kenya-inspired, 2025-11-01 to 2026-10-31 EAT). `temperature_logs` is **facility-level**, not named-fridge telemetry; `units.temp_excursion_exposed` and final `units.status` are **retrospective labels**, not real-time inputs for predicting a decision. We must not leak them into a prospective model. Missing values mean **unknown**, not safe. Component storage conditions differ: do not blindly apply RBC/whole-blood thresholds to platelets or frozen products.

Supplementary evidence: [WHO 2025 Good Practices for Blood Establishments](https://www.who.int/publications/m/item/trs-1060---annex-4--good-practices-for-blood-establishments), WHO Digital Implementation Investment Guide (2020), and UNICEF Designing Digital Interventions for Lasting Impact. Published guidance informs prototype design but does not constitute site-specific clinical approval. No real donor, patient, or facility data will be used.

## African conditions
Implemented phone-responsive layout, small static web bundle, no required AI inference call, local evidence evaluation, localStorage and a service worker that caches first-party assets. This is a realistic offline *prototype direction*, **not** a measured field deployment. We have not verified actual low-end-phone performance, offline reopening, SMS reach, multi-site synchronization or a second-country deployment. Site-specific SOPs and unit identity integration are still required.

## AI tools we used
- **ChatGPT (GPT-6):** research and scope analysis, data-provenance review, generation of browser prototype code/CSS, review state machine, deterministic evidence engine, unit tests, GitHub commits, documentation and caveat checking.
- **GitHub Actions:** automatic syntax checks and Node-based tests (not AI).
- **Claude:** not used for this committed implementation at this stage; update this section if a rostered collaborator genuinely uses it later.
- All delivered application code was newly authored inside the official 24-hour window. Do not copy code from the separate pre-hackathon research repository.

## Team
| Name | Role | Country | Presenting Friday (in person / online) |
|---|---|---|---|
| **To confirm against official team roster** | **To confirm** | **To confirm** | **To confirm** |

## Known limits and next steps
1. **Urgent organizer/admin:** confirm approved team roster and solo request; make this repository public **before** final submission, with the organizer's permission. Only approved roster members should contribute.
2. Attend expert Q&A with Ted Nyaoke and Richard Odongo; validate incident review responsibility, fridge/unit traceability, missing data handling and local SOPs. Document the answers without inventing user research.
3. Test the HTML UI visually on phone and desktop. Run a manual disconnected browser test after first online load; do not silently assume service worker caching works.
4. Extend evaluation to **unselected holdout cases** or a fully reproducible source dataset scan; our four hand-picked examples do not establish general detection rates. Consider testing against a truly strong rules-based case-management baseline, including human time-to-completion, not only detection.
5. Record a ≤3-minute demo of the complete operator → quality reviewer → mock guard workflow, and prepare at most eight slides per detailed technical brief.
6. Publish clear deployment/testing instructions and the verified live link when available. Do not claim actual clinical interoperability.

## Hackathon compliance
Code written only within 10 Nov 2026 12:00 EAT to 11 Nov 2026 12:00 EAT. Commit incrementally. Only rostered members build. One team repo; make public by submission deadline. Open-source dependencies allowed; no pre-existing application code copied from earlier projects. Disclose synthetic data additions and AI tools honestly.
