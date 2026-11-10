# Step 2 — Neon + Clerk implementation (not Supabase)

## Status
- Separate Neon project: `trustledger-incident-operations` (`frosty-dawn-57250959`), independent from StandPilot.
- Reviewed SQL migration: `db/migrations/001_initial.sql`; prepared/tested on isolated branch before production application.
- Auth architecture: Clerk JWT verified by server. The database stores *facility-scoped* staff memberships and roles; never accept a role supplied by browser request.
- Vercel's production site remains on its stable link and existing demo behavior until server migration and verified two-browser login.

## First shared-data acceptance
1. Facility admin creates/invites test operator and independent test reviewer.
2. Server confirms Clerk session and membership for every read/write.
3. A test incident is created; both authorized accounts can read the same row after refresh.
4. Operator cannot approve their own incident. Reviewer can write a reasoned decision, which becomes an append-only event.
5. An unauthorized user, another facility, and unauthenticated requests receive 403/404.

## Schema
`tl_facilities`, `tl_memberships`, `tl_data_sources`, `tl_imports`, `tl_temperature_readings`, `tl_incidents`, `tl_incident_evidence`, `tl_incident_events`, and `tl_followups`.

Readings preserve original raw values and source row/timestamp. Incident evidence records keep provenance. Facility-scope checks and role transitions must be enforced at API layer. This schema alone does not confer secure authentication or a regulated immutable audit: table owner can still alter records, and a privileged DB connection must never be exposed.

## Deployment prerequisites
- New or appropriate dedicated Clerk app for TrustLedger (do not reuse StandPilot's app or staff membership).
- `DATABASE_URL` Neon pooled TLS URL configured as **server-only secret** in TrustLedger Vercel environment; never print, commit or send it in chat.
- `CLERK_SECRET_KEY` server-only secret; `CLERK_PUBLISHABLE_KEY` public config.
- Narrow Vercel API endpoints and verified server-side auth before enabling incident writes.
- Security test with two identities and two browser sessions, including denial tests.
- Only eligible synthetic data; no actual clinical operational decisions.

## Source compatibility
Existing `src/engine.js` source-aware deterministic checks are reusable, but it currently uses localStorage and a mock reviewer. Do NOT confuse legacy demo state with actual backend state or claim cross-device persistence before the API and frontend are wired.

## Rollout
Keep this branch isolated until database migration, authorization middleware, API tests and frontend sign-in pass. The current production URL continues serving prior version until verified release.
