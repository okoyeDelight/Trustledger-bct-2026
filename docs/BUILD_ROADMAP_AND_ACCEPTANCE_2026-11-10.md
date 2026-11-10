# TrustLedger — Locked Build Roadmap & Acceptance Gates
**Date:** 10 Nov 2026 (WAT)  
**Repository:** `okoyeDelight/Trustledger-bct-2026`  
**Permanent production URL:** https://trustledger-bct-2026.vercel.app  
**Product:** blood cold-chain incident investigation and accountable follow-up. This is NOT a system that determines clinical blood release.

## Product promise and first user
A duty worker can see an incident generated from original monitoring data or report one manually; verify the source and evidence; investigate; send findings to a separate quality reviewer; and record a human decision, action owner and follow-up. Another authorized user sees the same records after refreshing. Administrator can explain the origin of every machine-generated incident.

**Do not build:** donor recruitment, forecasting, multi-hospital marketplace, bedside transfusion, automatic discard/clinical release, "magic AI" insights, invented hardware integrations, unrelated dashboards, whole-system ERP.

## Nonnegotiable data boundaries
- Competition: ONLY organizer synthetic or otherwise eligible open/synthetic data; never real patient, donor or real facility records. The official website says this explicitly.
- Organizer `temperature_logs.csv` readings are facility-level (`facility_id`, `recorded_at`, `temp_c`), not identified refrigerator probes. Do not infer a specific blood unit was exposed. Additional `DEMO-*` custody mapping is separately fictional, not original dataset evidence.
- Preserve raw source file, source identity, original row/timestamp, import timestamp, validation errors, normalized fields and rule version. Never fabricate missing measurements or turn an implausible 99.9°C sentinel into an actual 99.9°C excursion.
- Example 2–6°C band is an illustrative synthetic RBC rule until a blood-service professional provides an approved component-specific SOP; this is NOT universal clinical policy.
- The existing localStorage reviewer and issue guard are *simulated*. Do not describe any output as clinical release authorization. No live equipment or blood-bank integration until implemented and independently verified.
- Existing four-case classifier does not outperform a competent gap-aware rules baseline (both 4/4 on hand-picked cases). Product distinction is accountable, transparent incident workflow, not better ML accuracy.

## Stack and source of truth
- **Repo:** Keep one implementation in this repository. Stop creating separate Vercel copies and unmerged experiments. Protect working code; use branches/preview deployments for changes and merge only after tests.
- **Frontend:** Reuse and simplify existing mobile-responsive HTML/CSS/JS and tested source-aware engine. Avoid framework migration without clear necessity.
- **Hosting:** Existing Git-connected Vercel project and fixed production URL; commits merged to main redeploy it. Preview branches for verification.
- **Persistent data + authentication:** Use **Neon PostgreSQL + Clerk Authentication**, matching the tested architecture pattern from StandPilot but in separate TrustLedger accounts/project and data. Keep the Vercel frontend/API and use private environment variables. Neon Free and Vercel Hobby are evaluation resources with quota limits; not regulated production infrastructure. Credentials configured only through hosting provider secrets, never in repository or chat.
- **Server:** Narrow ingestion/API layer enforcing schema, source auth, deduplication, role checks and append-only events. Never trust client-provided roles/statuses.
- **Security minimum:** Invite-only operator, reviewer and admin accounts; per-facility data scope; least-privilege row-level access; server-enforced separation of submitter and reviewer; audit trail not editable in ordinary UI.

## The single end-to-end workflow (one source, one facility first)
`Source (file/API replay)` → `raw import + validation + provenance` → `rules generate incident OR staff reports incident` → `one incident queue` → `operator investigation` → `reviewer decision` → `action/follow-up` → `history + export`.

### Stage 0 — Scope lock and continuity
**Build:** Record this roadmap, preserve existing proof/tests, identify which existing modules can be reused (`src/engine.js`, `src/source_evidence.js`, CSV audit scripts), and choose one production branch and one URL. Preserve a known-good rollback commit.
**Pass gate:** Everyone can describe one worker journey and which prototype is the source of truth. No link or code duplicated.

### Stage 1 — Real data model and authenticated accounts
**Build:** DB migrations for `facilities`, `memberships/users`, `data_sources`, `imports`, `raw_temperature_readings`, `incidents`, `incident_evidence`, `incident_events`, `incident_followups`. Include stable IDs, original timestamps with EAT interpretation, created_at, foreign keys and row-level policies. Implement login + worker/reviewer/admin permissions, two distinct test accounts.
**Pass gate:** Two browsers sign in as different people, see shared facility records after refresh; unauthorized actions are refused by server, including direct API access. No secret exposed to browser.

### Stage 2 — Working source import and provenance
**Build:** Begin with `temperature_logs.csv` and `power_outages.csv` or a curated verified subset. Real upload endpoint reads file, checks schema/size, preserves raw input and metadata, records errors, normalizes valid records, retains raw questionable readings. Surface an admin-facing `Data Sources` page: source, upload time, records accepted, flagged, rejected and latest import. Add an authenticated synthetic event replay/API sample showing future integration contract, clearly marked as replay rather than live hardware.
**Pass gate:** Uploading synthetic source rows creates persisted records with row-level provenance. Reimporting an identical file is idempotent; a bad schema produces understandable errors; there is no hidden fabricated reading.

### Stage 3 — Detection to incident queue
**Build:** Reuse deterministic rules: observed out-of-band values, missing expected hourly readings, implausible sentinel values. Deduplicate by source/facility/event interval/rule version, show urgency and evidence status. A source upload automatically creates/updates incidents, and all authenticated facility workers see the queue.
**Pass gate:** Source-backed TL-024 57-missing-hour incident, RBTC-NBO recorded 7.9°C excursion plus overlapping source outage, and 99.9°C sensor anomaly are distinguishable with cited raw rows. An upload never silently opens duplicate incidents.

### Stage 4 — Staff reporting
**Build:** `Report an incident` with type, facility/equipment if known, observed time, description, supporting evidence, optional attachment, and submit; allow linking to an existing auto-detected incident, prevent duplicate confusion.
**Pass gate:** User creates a real persisted report without temperature data; it appears in the shared queue, with reporter and timestamps.

### Stage 5 — Guided investigation
**Build:** Each incident has a focused page: what happened, timeline and original records, what is known/unknown, other relevant source records (e.g. outage), assignee, notes, observations, recommended action, and `Submit for review`. Do not assert a unit-to-fridge link absent from organizer data.
**Pass gate:** Worker can complete an investigation with valid evidence, save drafts, submit once, then reviewer sees exact evidence and history. Missing evidence remains explicitly unknown.

### Stage 6 — Independent review + workflow state
**Build:** Reviewer sees an `Awaiting review` queue; accept, request changes, or reject/change recommendation with required reasoning. Enforce role separation server-side. State transitions and every comment/decision are recorded append-only (with actor and timestamp).
**Pass gate:** Operator cannot approve their own case or spoof reviewer permissions. Returning an incident goes back to investigation; each state change is traceable.

### Stage 7 — Follow-up, closure and history
**Build:** Assign follow-up action owner, due date/status, supporting evidence, closure reason and any unresolved restriction. Allow administrative completion without claiming clinical clearance. History search by facility, incident, date, rule and status; simple human-readable record/export. Real blood inventory issuing is NOT supported.
**Pass gate:** Another user can find a closed case and replay full original evidence → report → investigation → review → follow-up. Reopening/changes preserve history.

### Stage 8 — Hardening and genuine demonstration
**Build:** Automated DB/API + browser tests for duplicate uploads, wrong timezones, malformed readings, unauthorized actions, immutable provenance/audit, role separation, refresh persistence and phone-size usability. Verify graceful loss of network: read-only cached UI/unsent draft explicitly labelled, never pretend unsynced decisions are saved. Record the real site in <=3 min: actual import → generated incident → investigate → separate reviewer login → decision → history. Publish a truthful diagram of file upload + synthetic API replay and future real adapter; create slides/README with exact limits.
**Pass gate:** Two independent browsers can perform full journey on one stable URL; tests pass; video uses real screens and does not depict nonexistent features.

## Build priority under deadline
**P0 — must finish in order:** Stage 0 → Stage 1 → Stage 2 selected temperature data → Stage 3 one clear source-backed incident → Stage 4 manual report → Stage 5 → Stage 6 → Stage 7 minimal follow-up → Stage 8 tests + actual video.  
**P1 — as time permits:** Second source outage corroboration, better data source summaries, synthetic event replay; prioritize these as product value and do not add new pages without completing P0.  
**P2 — after hackathon:** true device/BMIS integrations, multi-site onboarding, monitoring reliability metrics, offline conflict resolution, performance scaling, clinical site validation, regulatory/security reviews.

**Hackathon outcome:** A usable *synthetic-data incident-management system* that persists across real accounts and devices, not clinical production authorization. **Controlled real-world use** requires approved site SOP, verified equipment/unit custody, security/data protection assessment, audit/backup/restore and clinical partner evaluation.

## First technical work item after roadmap
1. Define DB schema and role matrix.
2. Add migrations, secure test authentication, and API contract.
3. Implement real CSV upload/provenance before redesigning dashboard.
4. Swap one incident journey from localStorage to shared persisted backend.
5. Run two-account cross-browser test before adding second source/integration.

## Stop rules
- Do not claim connected hardware without an actual tested authenticated feed.
- Do not say "shared" unless two separate browsers see the same server-persisted case.
- Do not say "source-verified" without exact raw record and import lineage.
- Do not claim clinical approval, safe issue, compatibility, device-to-unit provenance or patient harm.
- Do not start AI assistant, animations, extra products, or a large analytics dashboard before the critical path works.
