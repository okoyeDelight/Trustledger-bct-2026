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

An investigation submission, supervisor review, follow-up assignment/completion and administrative closure workflow is implemented on this branch, but **now backed by the approved migration on Neon main**, but not yet deployed or verified with real separate signed-in accounts. Real feed/CSV ingestion remains incomplete. Detected incidents currently originate from the reproducible build-time synthetic processing pipeline, not incoming live telemetry.

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

**Status (November 11, 2026):** User approved migration 002. It has been **applied to TrustLedger Neon main** and verified: 12 total tables, zero initial records, restricted API role can append but not edit/delete reviews. StandPilot untouched.

**Migration 003 applied with approval (November 11, 2026):** `db/migrations/003_case_lifecycle_events.sql` installed `tl_case_events` on TrustLedger Neon main. Verified **13 `tl_*` tables**, with zero case events, staff reports, investigation notes and review events initially; `trustledger_api` has SELECT and INSERT plus sequence usage, but **no UPDATE or DELETE** on case events. The temporary validation branch was deleted after application. This changes database structure only; production app has not been switched to the consolidated branch.

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
- Verify the staged case lifecycle migration and enforce shared status transitions with two signed-in browser sessions.
- Add overdue follow-up views, escalation rules and a clinically reviewed role matrix.
- Uploading new approved synthetic logs should trigger deduplicated incident creation and source lineage rather than requiring a build-time pipeline.
- Integrate managed auth and remove pre-provisioned demo passwords prior to real operational deployment.
- Production-grade identity, retention, clinical validation, staff usability testing, and network reliability remain outstanding.

## New lifecycle acceptance gates (migration 003)
- Worker must save an investigation finding before submitting to supervisor.
- Supervisor cannot review an incident without a submitted investigation.
- Return for more evidence requires a **new** worker finding before resubmission.
- Supervisor may assign a follow-up only after review; only its named operator can complete it.
- Unfinished actions block administrative closure. Clinical release/discard is **never** an available action.
- Case history is append-only; on hosted Neon deployment the restricted API role cannot UPDATE or DELETE events.
- **Never silently queue supervisor decisions offline.** An unsaved review must be retried when online. Legacy pending browser reviews are explicitly labelled unsynced.

## Two demo identities: local predeployment HTTP test

`backend/tests/test_two_account_api.py` uses two **independent** HTTP cookie jars and randomly generated process-local passwords, exercising login, manual report, shared queue, investigation note, submit, reviewer-only decision, follow-up, closure, audit/history, logout, unauthorized actions and tampered cookies. Tests run in GitHub Actions, not on Vercel and not on real patient or hospital data.

**Security:** the demo credentials previously disclosed must **never** be reused. Future preview account passwords must be random, different per role, and provided via private hosting environment variables. The two-user HTTP test is not a live cross-device Neon/Vercel deployment test; complete that once the final preview is approved. A separate restricted-role Neon branch test can verify persistent data/permissions without leaving synthetic test records in the live branch.

**Production status:** the approved `tl_case_events` migration has been applied. No need for further table approval for this journey. The site remains on the prior deployed version; preview builds stay disabled to conserve Vercel limits.
