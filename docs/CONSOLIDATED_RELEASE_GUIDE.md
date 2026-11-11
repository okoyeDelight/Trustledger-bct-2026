# TrustLedger — consolidated application (integration branch)

**Canonical code in this branch:** `frontend/` (Next.js worker interface), `backend/` (FastAPI + Python source-data processing), `db/migrations/` (Neon schema), and `vercel.json` (one-origin service routing).

This is one **source-code consolidation**, not a production launch. Legacy root `index.html`, `src/` and `styles.css` are preserved for reference and rollback. Their original Vercel configuration is preserved in `config/legacy-vercel-static.json`. The teammate's source remains reproducible at `candidate/teammate/` (exact source commit in `docs/CONSOLIDATION_SOURCE.md`). Do not claim two different browser apps are independently maintained after adoption.

## One primary worker journey

1. The Python pipeline loads **organizer synthetic data** from temperature, unit, transfer, facility, donation and outage CSVs. It validates records, flags glitches and gaps, identifies observed out-of-range episodes and matches facility-level candidate unit evidence conservatively. Source files are pinned by SHA and the original dataset is never represented as a real hardware integration.
2. A worker opens **Incidents**. The same list can include source-generated `INC-...` cases and manually reported `REP-...` cases.
3. Facility staff can submit **Report incident** with a synthetic facility code, observation time and description. No automatic implication of unit damage.
4. Facility staff records findings on the case detail page. Each finding includes a server-verified demo account, timestamp and original case reference.
5. A **different supervisor** accepts/changes/rejects the *investigation flag* with reason. The API rejects a facility staff account attempting the same review.
6. **History** shows saved review events. With Neon enabled these are database-persisted and append-only to the restricted API account. This still does NOT grant clinical release, quarantine, discard, compatibility or transfusion authority.

An investigation/follow-up assignment workflow and real feed/CSV ingestion are not yet complete. Detected incidents currently originate from the reproducible build-time synthetic processing pipeline, not incoming live telemetry.

## Architecture and same-origin deployment

Vercel Services configuration is defined in the root `vercel.json`:
- `frontend/` — Next.js 16 UI, routes under `/`.
- `backend/` — FastAPI Python service, under `/api/*` and `/health`.
- All browser API calls use **same-origin** `/api/*` in production. Local `npm run dev` uses `http://localhost:8000` when no API URL is set.
- API build runs `python backend/tools/fetch_synthetic_inputs.py` from service root then `python -m app.run_pipeline ...`. Six synthetic source CSVs are downloaded from a specific upstream Git SHA, with byte count + Git blob SHA verification. Do NOT publish any real donor, patient or facility records.
- Backend requires `DATABASE_URL` (restricted Neon role) for hosted write/read workflow; when `VERCEL=true` and DB is absent it fails closed with 503 rather than claiming persistence.
- SQLite remains only for local development/regression testing and must not be described as durable serverless storage.

## Security and access

Current login is a **synthetic-only, environment-provisioned demo** with a signed HttpOnly session, not Clerk/Neon Auth/MFA. Role split is now enforced by API:
- `facility_staff` — report incident, add findings; cannot sign supervisor review.
- `blood_service_supervisor` — view cases, sign review; cannot create worker reports or findings.
- No role may alter blood-unit clinical disposition.

Do not re-use exposed credentials. Hosted secrets must be set privately through the deployment provider, NOT stored in GitHub/chat. Before any actual partner/facility pilot, replace this demo identity layer with managed staff identity, account lifecycle, recovery, facility scope, audit retention, backup/restore, clinical SOP and practitioner validation.

Required hosting variables:
- `DATABASE_URL`: restricted, pooled, TLS Neon URL **server only**; keep `trustledger_api` read/write INSERT grants scoped to approved workflow tables; never use DB owner.
- `TRUSTLEDGER_AUTH_SECRET`: random strong 32+ character secret.
- `TRUSTLEDGER_DEMO_FACILITY_USERNAME`, `TRUSTLEDGER_DEMO_FACILITY_PASSWORD`, `TRUSTLEDGER_DEMO_FACILITY_NAME` — unique demo operator credentials and label.
- `TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME`, `TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD`, `TRUSTLEDGER_DEMO_SUPERVISOR_NAME` — different supervisor account; each password at least 12 characters.
- `TRUSTLEDGER_COOKIE_SECURE=true`; `TRUSTLEDGER_COOKIE_SAMESITE=lax` for same-origin routes.

Never paste secrets into issues, PRs, chat or frontend `NEXT_PUBLIC_*` variables.

## Database migration gate

`db/migrations/002_consolidated_workflow.sql` adds:
- `tl_staff_reports` — persisted manual cases.
- `tl_investigation_notes` — append-only worker findings.
- `tl_review_events` — durable human review decisions.

**Status:** prepared and verified on Neon temporary branch `br-weathered-darkness-zadmyurq`; API role had SELECT/INSERT but not UPDATE/DELETE. Temporary migration was **cancelled and deleted without applying to main**. It will need a fresh preparation and explicit approval before promotion. The existing nine-table Neon database remains intact; StandPilot was not touched.

## Developer validation

```bash
python3 -m pip install -r backend/requirements.txt pytest
python3 -m pytest -q backend/tests
npm --prefix frontend ci
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

To reproduce complete organizer synthetic data locally:
```bash
python3 backend/tools/fetch_synthetic_inputs.py
cd backend
python3 -m app.run_pipeline --data data/raw --output data/processed
uvicorn app.main:app --reload --port 8000
```
Then in a second terminal: `npm --prefix frontend run dev`.

Release requires green CI, successful preview build, a two-user cross-browser test and verified data provenance. Do not merge to `main` or replace the existing permanent website before these gates pass.

## Known gaps to build next

- A **monitoring gap** should become a first-class automatic incident rather than only a data-quality count.
- Facility-level data do not name individual refrigerators; do not invent device or named-unit exposure.
- Review submission should be linked to worker investigation, with assigned follow-up status and overdue work.
- Uploading new approved synthetic logs should trigger deduplicated incident creation and source lineage rather than requiring a build-time pipeline.
- Integrate managed auth and remove pre-provisioned demo passwords prior to real operational deployment.
- Follow-up, retention, clinician validation, testing on actual staff workflows, and reliability under network outages.
