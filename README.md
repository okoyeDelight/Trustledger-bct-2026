# TrustLedger — evidence-linked cold-chain investigation

**Terumo BCT Africa Hackathon 2026 · synthetic-data research prototype · not for clinical use**

## The one current solution

This repository contains **one active TrustLedger product**, with two cooperating applications:

| Component | Code | Permanent project address | Responsibility |
|---|---|---|---|
| **TrustLedger** | `frontend/`, `backend/`, `db/migrations/` | https://trustledger-bct-2026.vercel.app | Receives scoped source events, detects review candidates, supports investigator → independent supervisor → follow-up → administrative closure |
| **ABBIS Source Sandbox** | `abbis-sandbox/` | https://abbis-source-sandbox.vercel.app | Separately deployed **synthetic** blood-bank source, holding all eleven organizer-provided, checksum-verified CSV datasets, replaying qualifying source episodes automatically through the real HTTPS adapter |

The two applications are **one end-to-end solution**—not two versions of TrustLedger. The source sandbox is **not** an actual ABBIS service or device integration.

The historical static browser prototype remains in the Git history and legacy root files solely for reproducibility. It is **not** the app that should be built, deployed, pitched or edited. `candidate/teammate/` and `docs/teammate-upstream/` preserve authored upstream source/attribution and do not constitute separate live products. New features should target the current directories above.

## Start the judge demo

1. Open the [TrustLedger application](https://trustledger-bct-2026.vercel.app) and sign in as **Quality Supervisor** using privately provided demo credentials.
2. Open **Connections → Connect system**. Register source system **`ABBIS-SANDBOX`** and allowed facility **`HSP-028`**. Copy the generated **`tlc_` connector key once**. Do not put it in GitHub, screenshots or public slides.
3. Open the [ABBIS Source Sandbox](https://abbis-source-sandbox.vercel.app); paste the key into its connection form. The independent source authenticates against TrustLedger's API.
4. Leave ABBIS open: **one original, source-verified four-reading episode is sent every 60 seconds**, with automatic retry of interrupted episodes. Each individual observation is stored with an idempotent source ID. A qualifying four-consecutive-hour episode creates a provisional TrustLedger investigation case.
5. Watch **TrustLedger → Incoming incidents** refresh automatically. Log in as a **Facility Operator** to add a finding and submit. A **different Quality Supervisor** reviews, assigns follow-up and, once completed, may administratively close the investigation.
6. In ABBIS, use **Investigation updates** to retrieve the source-scoped status of that case from TrustLedger.

**Critical demo truth:** Automatic replay currently runs **while the ABBIS sandbox browser page is open**. It is not a hosted background scheduler. ABBIS holds eleven original datasets, but **the working connector sends verified temperature observations**; donation, unit, facility, outage and transfer files are retained on the source side and are not all streaming over separate API adapters yet. A logged observation is not a blood-unit exposure or clinical disposition decision.

**Full competition dataset:** ABBIS verifies the official 11-file starter archive, including donors, drives, routes, requests and daily stock in addition to the six initial cold-chain inputs. Its search API lets workers choose source evidence from the full original catalog, attaching record ID, dataset revision and checksum to a human report. The working automatic connector still streams temperature readings only; other tables are available for source lookup, not claimed as event streams.\n\n**Empty-queue principle:** The operational TrustLedger queue is driven only by newly received connected-system cases or intentional staff reports; its historical evaluation data do not auto-populate the live incident queue. Historical research remains available in evidence and test artifacts, never misrepresented as incoming live records.

## Current application architecture

```text
ABBIS Source Sandbox (Next.js, all 11 verified synthetic CSVs and verified replay catalog)
       │ X-TrustLedger-Connector-Key (hashed, facility-scoped, revocable)
       ▼
TrustLedger FastAPI /api/connectors/v1/observations
       │ append-only observations → deterministic evidence rules
       ▼
Neon PostgreSQL → investigation cases → facility worker → supervisor
       │                                          │
       └── authenticated case status API ◄────────┘
                  ▲
            ABBIS status view
```

- **Current schema:** migrations `001`–`005`; `005_connector_credentials.sql` provides hashed connector registration and append-only revocation. Do not apply unrelated or duplicate connector migrations.
- **Security:** distinct environment-provisioned demo accounts; API role boundaries; source/facility-scoped connector keys; never publish API keys or DB credentials.
- **Data integrity:** original source file hashes verified against pinned upstream commit; repeat event IDs acknowledged only for identical source payload; conflict returns HTTP 409; invalid/sentinel temperature is rejected; out-of-order evidence is retained where supported.
- **Clinical boundaries:** no blood issue, discard, product-compatibility or transfusion authorization. A facility-level temperature flag alone cannot prove an individual unit was exposed. Site SOPs, managed identity and clinician evaluation are required before any real-world use.

## Repository map

- `frontend/` — **canonical TrustLedger UI** (Next.js 16)
- `backend/` — **canonical TrustLedger API**, source validation, workflow and tests (FastAPI)
- `abbis-sandbox/` — **separate source simulator** (Next.js) with eleven verified synthetic CSVs
- `db/migrations/` — Neon persistence and append-only event tables
- `submission/` — demo and judge-ready materials
- `docs/` — evidence, security, limitations and historical engineering record
- `src/`, `index.html`, `styles.css` — superseded static prototype (Git-history preservation only)
- `candidate/teammate/` — preserved upstream reference and attribution, not a deployment target

## Verify the current build

```bash
python3 -m pip install -r backend/requirements.txt pytest httpx
python3 -m pytest -q backend/tests
npm --prefix frontend ci
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix abbis-sandbox ci
npm --prefix abbis-sandbox run typecheck
npm --prefix abbis-sandbox run build
```

The ABBIS build obtains only the eleven verified synthetic source CSVs and verifies every Git blob SHA; never substitute donor or patient data. For the two-account case workflow and staged deployments, see [release guide](docs/CONSOLIDATED_RELEASE_GUIDE.md), [judge evidence](docs/SUBMISSION_EVIDENCE_2026.md), and [final demo script](submission/DEMO_SCRIPT_FINAL_2026.md).

## Submission boundaries

Historical starter observations were generated for this hackathon. The current integration is a real **software-to-software demo with source-authenticated HTTP requests**, not a production ABBIS connection or a measured impact evaluation. Competent conventional rules are a relevant benchmark; do not claim measured clinical superiority, prevented patient harm or international compliance.

Keep this repository private until teammate code redistribution rights and any organiser publication requirements have been reviewed. The permanent Vercel addresses may exist even when a specific preview deployment is protected; verify guest access before submission.

**Single source of truth:** this README and the current `frontend/` + `backend/` + `abbis-sandbox/` code. Existing legacy files may be archived from the default branch **after** production verification, never by wiping the working applications.
