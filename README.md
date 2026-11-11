# Team TrustLedger: Evidence-linked blood cold-chain investigations

Terumo BCT Africa Hackathon 2026 · **Challenge area: Cold chain**

**Synthetic research prototype, not validated clinical software.**

## The problem

A facility blood-bank operator receives temperature readings and may see an apparently normal temperature despite missing observations, sensor errors or incomplete transfer records. A separate quality supervisor must understand which observations support a suspected cold-chain incident, which facts are uncertain and what action a worker actually took. Manual handoffs and disconnected evidence can make that difficult.

In the organizer's synthetic dataset, our reproducible audit identified **399,280** facility temperature readings, **55** documented sentinel sensor values and **387** monitoring-gap intervals accounting for **12,273** expected hourly readings that were not observed. These are data-quality findings—not evidence of actual patient harm or blood units made unsafe.

## What we built

**What works now:**

- **ABBIS Source Sandbox**, a separate synthetic source system that verifies and catalogs **all 11 original organizer-provided CSV tables**. It provides source-record lookup and search so workers can choose an existing record rather than manually typing an ID.
- **Real application-to-application adapter:** A Quality Supervisor registers an ABBIS source and a permitted facility, generates a one-time API key, and can revoke it. ABBIS sends historical synthetic temperature observations via HTTPS. TrustLedger validates schema, connector scope and unique source IDs, stores receipts, and creates a provisional case if the configured rule is met.
- **One end-to-end investigation workflow:** Facility Operator records findings and submits a case. An independent Quality Supervisor can Accept, Change or Reject the investigation assessment, assign follow-up, and administratively close it after the documented steps.
- **Evidence Passport and event history:** Incident details show original temperature samples, dates, source references, a graph and explicit uncertainty. Worker and supervisor actions are stored in append-only audit/event records in Neon PostgreSQL.
- **Automatic demo stream while ABBIS is open:** The sandbox sends one *four-reading episode* about every 60 seconds. Four consecutive hourly samples produce **one** potential incident, not four independent incidents. The first-to-last reading span is **three hours**, which is not a confirmed blood-unit exposure duration.
- **Mobile-friendly interface and fallback:** A worker can make an independent report when source search is unavailable; rule-based detection and human review do not depend on a generative AI service.

**What is mocked or not finished:**

ABBIS is a **synthetic sandbox**, not a connected hospital, device or operating blood-bank service. The current connector automatically sends **temperature observations only**; the other organizer tables are searchable as source evidence, not continuously streamed through separate adapters. Automatic replay depends on the ABBIS browser page remaining active; a persistent background scheduler is not deployed. There is no clinical authorization to release, discard or approve a blood product.

**Demo video (3 minutes or less):** **[Team must insert the actual shareable video URL]**

**Live demo:** [TrustLedger](https://trustledger-bct-2026.vercel.app) · [ABBIS Source Sandbox](https://abbis-source-sandbox.vercel.app)

**Test log-in:** Two distinct TrustLedger demo usernames, \`operator\` (Facility Operator) and \`supervisor\` (Quality Supervisor). Provide temporary passwords securely in the judge submission form; **do not post them in this public README**. A separate one-time key is generated in **Connections** for ABBIS.

## How to run it

### Judge quick start (browser)

1. Sign in to [TrustLedger](https://trustledger-bct-2026.vercel.app/login) as **supervisor**, then open **Connections**. Register source \`ABBIS-SANDBOX\` for facility \`HSP-028\` and copy its one-time API key.
2. Open the [ABBIS Source Sandbox](https://abbis-source-sandbox.vercel.app), connect the key and keep that browser page open to enable the automatic synthetic feed.
3. In TrustLedger, open **Incoming incidents** to see individual received readings and the resulting \`EXT-\` case. Open its **Evidence Passport** for original timestamps, temperature graph and source identifiers; the observed span and clinically unknown exposure duration remain distinct.
4. In a different browser session, sign in as **operator**, record findings and submit them. As **supervisor**, review the case and any follow-up. Return to ABBIS to fetch the case's status over the authenticated API.
5. As operator, open **Report incident**, search the complete ABBIS catalog, select a source record and report an issue; the facility and source reference are attached rather than copied from memory.

### Run locally (developer)

Requires Python 3.11+, Node.js 22+, and organizer synthetic data; store secrets in environment variables, never in this repository.

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt pytest httpx
python backend/tools/fetch_synthetic_inputs.py
(cd backend && python -m app.run_pipeline --data data/raw --output data/processed)
# In one terminal:
(cd backend && uvicorn app.main:app --reload --port 8000)
# In a second terminal:
npm --prefix frontend ci
npm --prefix frontend run dev
# Optional separate ABBIS source application:
npm --prefix abbis-sandbox ci
npm --prefix abbis-sandbox run build
npm --prefix abbis-sandbox run dev
\`\`\`

The locally started API uses separately configured \`TRUSTLEDGER_AUTH_SECRET\`, \`TRUSTLEDGER_DEMO_FACILITY_*\` and \`TRUSTLEDGER_DEMO_SUPERVISOR_*\` values, plus local SQLite or a restricted \`DATABASE_URL\` for Neon. The ABBIS build fetches the **original 11-file organizer ZIP** and verifies its SHA-256 and each CSV before serving the dataset. See [frontend setup](frontend/README.md) and [release notes](docs/CONSOLIDATED_RELEASE_GUIDE.md).

## Architecture

\`\`\`mermaid
flowchart LR
    A["11 original synthetic CSV datasets"] --> B["ABBIS Source Sandbox<br/>catalog, search & time-based replay"]
    B -->|"HTTPS temperature observations + connector key"| C["TrustLedger FastAPI<br/>source validation & review rules"]
    C --> D[("Neon PostgreSQL<br/>append-only source receipts & case events")]
    D --> E["Next.js worker dashboard<br/>Evidence Passport"]
    E --> F["Facility Operator<br/>investigation & submission"]
    F --> G["Independent Supervisor<br/>Accept / Change / Reject"]
    G --> D
    C -->|"Authenticated case-status lookup"| B
\`\`\`

ABBIS owns original synthetic source records; TrustLedger owns evidence-backed investigation cases and the human review trail. The two applications form **one integrated solution**, not competing implementations.

**Standards:** Current integration uses a project-specific versioned \`trustledger.observation.v1\` JSON/HTTPS contract. We do **not** claim a certified FHIR, DHIS2 or ISBT 128 interface.

## AI and data

- **What the AI or data feature does:** Deterministic, source-preserving checks detect out-of-range sequences, missing observations and known invalid sensor values, then give a human readable Evidence Passport. The current safety-critical flow does **not** rely on a trained ML model or LLM.
- **Baseline:** A latest-reading-only rule, plus a **competent** conventional temperature/gap/glitch rule comparator.
- **Result (four deliberately selected synthetic test scenarios):**

  | Evaluation method | Correct flags / 4 | Meaning |
  |---|---:|---|
  | Latest-reading-only check | 1 / 4 | Deliberately weak illustrative baseline |
  | Competent conventional rules | 4 / 4 | Already catches the relevant issues |
  | TrustLedger evidence rules | 4 / 4 | **Ties** competent detection; no measured detection superiority |

  This is a four-case illustrative smoke test, **not** a held-out evaluation, independent clinical validation or proof of better patient outcomes. TrustLedger's proposed added value is source traceability, uncertainty, human accountability and documented handoff—not superior clinical detection accuracy.
- **Reasons visible to users:** the exact source timestamps, values, gaps, quality flags, facility-level correlation and incomplete evidence, displayed in the Evidence Passport.
- **Human approval:** the separate Quality Supervisor accepts, changes or rejects a **provisional investigation assessment**. The system never authorizes transfusion, compatibility decisions, a clinical release or quarantine removal.
- **If AI is wrong or offline:** deterministic checks and staff reporting remain available without LLM inference; sensitive approvals require server connectivity and are not silently committed while offline. A case cannot be clinically cleared by the prototype.

## Data

**Source:** Organizer-supplied **synthetic** Terumo BCT Africa Hackathon 2026 starter archive, modelled on a Kenyan blood system. ABBIS verifies all 11 original tables by ZIP checksum and per-file hashes:

\`facilities\`, \`routes\`, \`donors\`, \`drives\`, \`donations\`, \`units\`, \`transfers\`, \`requests\`, \`daily_stock\`, \`power_outages\`, and \`temperature_logs\`.

The incident detection pipeline originally processes a narrower six-table subset, while the current ABBIS catalog/search covers all 11. The automatic connector currently transmits temperature observations, not all 11 categories of events. Verified original files are loaded at build time rather than committed to Git; the source manifest records hashes and row counts.

No real donor, patient, hospital or operational medical records were used. Any separate invented adversarial examples are explicitly labelled fixtures. This repository does not assert a redistribution licence for the organizer ZIP.

## African conditions

- Responsive interface for phone-sized screens; concise case fields and searchable record selection reduce manual entry and transcription errors.
- Original time, ingestion time and review time are kept distinct, including historical simulation date caveats.
- Deterministic checks need no hosted inference and make data gaps/unknown conditions visible rather than guessing what happened during connectivity loss.
- Source retries are idempotent. If a network or source service is unavailable, the user can create a clearly labelled uncorroborated staff report.
- Country-specific temperature policy, local clinical SOP validation, languages, power-resilience and managed offline synchronization are **future work**, not proven cross-country deployments.

## AI tools we used

- **ChatGPT (GPT-6):** architecture and workflow discussion, source-data evaluation, code implementation assistance, test design, documentation and debugging.
- **Claude:** used by a team member for coding/design only if reflected in the team's actual work; **confirm with the teammate before claiming this in the official submission**. No model is in the clinical decision path.
- **GitHub Actions:** automated CI (not itself an AI tool).

All contributors must be able to explain and defend the submitted workflow and code.

## Team

**Confirm the official roster, contribution roles and Friday presentation availability before final submission; do not invent names.**

| Name | Role | Country | Presenting Friday (in person / online) |
|---|---|---|---|
| [Fill from official team roster] | [Role] | [Country] | [In person / online] |

Original teammate code provenance and attribution are recorded in [docs/CONSOLIDATION_SOURCE.md](docs/CONSOLIDATION_SOURCE.md). The historical duplicate source tree is archived on the private branch \`archive/teammate-source-snapshot-2026\` and is **not a second active application**.

## Known limits and next steps

This is a competition demonstration, not certified clinical software. We do not know real fridge-to-unit occupancy from facility-level logs, cannot establish confirmed exposure of a named blood unit, and do not send clinical release or discard instructions. The synthetic ABBIS app is not real hardware integration. Additional table-specific live adapters, server-side continuous scheduling, managed identity/MFA, real-device validation, full offline synchronization, clinical SOP review, site authorizations and prospective evaluation remain necessary.

**Submission checklist:** Add the finished ≤3-minute video link, confirmed official roster/presenter details and confidential judge test login through the organizer's form; verify both public demo links. The organizer's written Technical Phase Brief says the **GitHub repository must be public by the submission deadline**; adjust repository visibility accordingly if still private.

**Further proof:** [submission evidence](docs/SUBMISSION_EVIDENCE_2026.md) · [demo script](submission/DEMO_SCRIPT_FINAL_2026.md) · [source provenance](docs/CONSOLIDATION_SOURCE.md).
