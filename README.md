# TrustLedger — Blood cold-chain exception-to-unit review

**Terumo BCT Africa Hackathon 2026 · Team TrustLedger · Challenge areas: Cold chain + Data quality**

> **Status: interactive browser prototype implemented, core decision rules passing automated tests; live deployment, broader data validation, expert review and end-user testing are still pending.** This is a hackathon prototype using synthetic data, NOT a clinically validated blood-bank system. Do not use it for real transfusion decisions.

## The problem
Our intended user is a blood-bank duty operator investigating a temperature excursion or a gap/implausible value in monitoring records, supported by an authorized quality reviewer. The hypothesis is that assembling reliable readings, power-outage context, possible affected inventory, and documented actions in one case can reduce missed evidence and incomplete reviews. **This precise frontline bottleneck has not yet been validated with a blood-service practitioner.**

The organizer's synthetic Kenya-inspired dataset contains 399,280 hourly facility-level temperature readings, 2,609 power-outage records, 49,426 units, and 35,181 transfers. It contains deliberately missing/implausible records. These are SIMULATED issues, not statistics about any real facility.

## What we built
- **Implemented:** responsive four-case cold-chain control room, source-backed evidence plots, 57-missing-hour detection, recorded synthetic excursions and sensor outlier preservation, candidate inventory fixture labels, operator proposal, separate *simulated* reviewer Accept/Change/Reject, persistent browser-local audit, a mock issue guard, benchmark screen and service-worker application-shell cache.
- **End-to-end demo:** choose HSP-024 → inspect normal latest readings but 57 missing hourly records → attempt mock issue (blocked) → submit a hold recommendation as operator → approve or change as simulated reviewer → re-attempt mock issue (still blocked, with a logged reason). Choose the clean control case to show that a separately reviewed mock issue can be allowed; this is NOT clinical release.
- **Tests:** [GitHub Actions](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/workflows/verify.yml) runs syntax checks and 10 Node assertions across data gaps, excursions, glitches, baseline behavior, review and issue guard. The initial CI run passed. Tests are not a substitute for end-user or browser QA.
- **Not implemented:** authenticated reviewer identities, server/database, integration with hardware or a live blood system, patient/compatibility decisions, validated unit-to-fridge provenance, production-grade immutable audit, real offline synchronization, or clinical validation.
- **Demo video (≤3 minutes):** not recorded yet.
- **Public live demo:** not deployed yet. Browser demo has no login: two roles are simulated in one page.

## How to run it
No installation or API keys are needed. **Do not open index.html via the file:// scheme:** browser module loading requires an HTTP server.

~~~bash
git clone https://github.com/okoyeDelight/Trustledger-bct-2026.git
cd Trustledger-bct-2026
python3 -m http.server 8080
# Open http://localhost:8080/
~~~

For automated checks (Node.js 20+): \`npm test\`. The same tests and JavaScript syntax checks run automatically on pushes to \`main\`.

All four demonstration windows are embedded in \`src/engine.js\` from exact temperature records in the organizer's synthetic dataset; there is no runtime fetch of patient data, no external AI API and no database. Browser state is stored under a namespaced \`localStorage\` key. **Reset demo** clears local decisions but preserves source records. After one online visit the service worker attempts to cache the static application shell for re-opening offline; device-specific offline behavior still needs browser testing.

## Architecture
Actual implemented architecture (browser-only MVP, not the final clinical architecture):

~~~mermaid
flowchart LR
  Source["Starter synthetic facility temp CSV (curated rows)"] --> Fixture["src/engine.js case evidence"]
  Extra["Clearly labelled DEMO unit and fridge fixture"] --> Fixture
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

Data source and invention boundary: [PROVENANCE.md](data/PROVENANCE.md). The source temperatures are **facility-level** and the named-fridge and unit assignments are deliberately created supplemental synthetic fixtures. We do not claim to have reconstructed unit exposure. This first release does not use \`power_outages.csv\`, \`transfers.csv\` or real \`units.csv\` as runtime features; future import must preserve time and location uncertainty. Standards such as ISBT 128 and HL7 FHIR are integration ideas, not implemented compliance.

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
