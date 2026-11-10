# Step 2 — Neon + Clerk implementation (not Supabase)

## Status
- Separate Neon project: `trustledger-incident-operations` (`frosty-dawn-57250959`), independent from StandPilot.
- Reviewed SQL migration: `db/migrations/001_initial.sql`; applied to the separate Neon main database after user approval on 10 Nov 2026; all nine tables confirmed. The temporary validation branch was deleted.
- Auth architecture: Clerk JWT verified by server. The database stores *facility-scoped* staff memberships and roles; never accept a role supplied by browser request.
- Vercel's production site remains on its stable link and existing demo behavior until API authentication and verified two-browser login.

## First shared-data acceptance
1. Create/configure a distinct TrustLedger Clerk app and server-only deployment variables, then provision staff identities and authorized facility memberships.
2. Server confirms Clerk session and membership for every read/write.
3. A test incident is created; both authorized accounts can read the same row after refresh.
4. Operator cannot approve their own incident. Reviewer can write a reasoned decision, which becomes an append-only event.
5. An unauthorized user, another facility, and unauthenticated requests receive 403/404.

## Schema
`tl_facilities`, `tl_memberships`, `tl_data_sources`, `tl_imports`, `tl_temperature_readings`, `tl_incidents`, `tl_incident_evidence`, `tl_incident_events`, and `tl_followups`.

Readings preserve original raw values and source row/timestamp. Incident evidence records keep provenance. Facility-scope checks and role transitions must be enforced at API layer. This schema alone does not confer secure authentication or a regulated immutable audit: table owner can still alter records, and a privileged DB connection must never be exposed.

## Applied database check
- Project: `frosty-dawn-57250959`, database: `trustledger`, default branch: `main`.
- Verified: nine `tl_*` tables exist; `tl_facilities`, `tl_memberships`, `tl_incidents`, `tl_incident_events` and `tl_data_sources` are empty.
- No test accounts, facility membership, real incident data, or web connection have been enabled yet.

## Deployment prerequisites
- New or appropriate dedicated Clerk app for TrustLedger (do not reuse StandPilot's app or staff membership).
- **Already configured:** `DATABASE_URL` in the dedicated TrustLedger Vercel project for preview/production, using restricted `trustledger_api` (not database owner). Database grants allow read access and insert-only on incidents/events; no staff membership editing or audit-event rewriting.
- **Already configured:** production-only `TRUSTLEDGER_PUBLIC_ORIGIN=https://trustledger-bct-2026.vercel.app`. Only this origin may make staff incident POST requests.
- **Owner action:** create a separate TrustLedger application at https://dashboard.clerk.com/ (do not reuse StandPilot application). Copy its **publishable** key (`pk_test_*` during sandbox evaluation). It is not secret; never share `sk_*` or any secret key.
- **After public key exists:** set `TRUSTLEDGER_CLERK_PUBLISHABLE_KEY` on the TrustLedger Vercel project (production, and controlled preview if needed), and `TRUSTLEDGER_CLERK_ISSUER` to the `https://<frontend-api-domain>` for that same Clerk application, without slash/path. Add the TrustLedger site as an allowed sign-in origin in Clerk. Redeploy to generate `/workspace/auth-config.js`, which exposes only the publishable key.
- Backend verifies signed Clerk session JWT with JWKS and matches the `azp` claim to the configured public origin. No Clerk secret key is required by these endpoints.
- `GET /api/session` lists the authenticated user's server-approved facility memberships. `GET/POST /api/incidents?facility=<uuid>` lists and creates staff reports, with membership/role checks on every request. The `/workspace/` page is fail-closed without Clerk configuration.
- Facility and staff bootstrap must be performed by an administrator (out-of-band via Neon with verified Clerk IDs). **Never** auto-grant admin to the first person who signs up.
- This branch is not merged, the real database is empty, and live multi-user login is not yet verified.
- Security test with two identities and two browser sessions, including denial tests.
- Only eligible synthetic data; no actual clinical operational decisions.

## Source compatibility
Existing `src/engine.js` source-aware deterministic checks are reusable, but it currently uses localStorage and a mock reviewer. Do NOT confuse legacy demo state with actual backend state or claim cross-device persistence before the API and frontend are wired.

## Rollout
Keep this branch isolated until database migration, authorization middleware, API tests and frontend sign-in pass. The current production URL continues serving prior version until verified release.
