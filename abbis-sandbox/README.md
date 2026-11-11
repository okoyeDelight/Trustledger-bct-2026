# ABBIS Source Sandbox — independent source application

**Purpose:** Demonstrate an external blood-bank system sending actual HTTPS observations into the real TrustLedger backend, then consuming source-scoped investigation status through a separate return API.

The **source system is synthetic**; the connector protocol, authentication, observation persistence, detection and case status are real. This is **not an official ABBIS implementation**, live clinical data feed, medical device, or standards-certified HL7/FHIR integration.

## Architecture

- Application deployed as **its own Vercel project and hostname**, distinct from TrustLedger.
- `/data/source.json` contains four pinned source readings: HSP-028 on 2025-11-01 00:00–03:00, 7.4°C, 8.2°C, 9.1°C, 10.1°C. Extracted directly from the pinned six-file synthetic dataset by TrustLedger's CI at upstream Git revision `da2862ff9db262f40cd1776fd7962ed47d8942ec`. Original timestamps lack timezones; UTC is assumed for sandbox transport only.
- Quality Supervisor creates a TrustLedger connector via `/connections` using **source `ABBIS-SANDBOX`, facility `HSP-028`**. Copy the one-time API key securely.
- Paste the key into this sandbox. The sandbox server calls TrustLedger `GET /api/connectors/v1/connection`, validates source/facility scope, and stores the key **encrypted in a SameSite=Strict, HttpOnly cookie** (24-hour lifetime) with AES-256-GCM, protected by `SANDBOX_SESSION_SECRET`.
- `POST /api/replay` sends each historical reading through **real server-to-server HTTPS** `POST /api/connectors/v1/observations` using the scoped secret, receives one acknowledgment each, and can safely retry duplicates.
- `GET /api/cases` polls `GET /api/connectors/v1/cases`, returning only cases for this connector's source and facility. The worker and supervisor interact on TrustLedger itself.
- Session keys are not placed in source files, browser JavaScript, frontend localStorage, query params, or deployment logs. A Vercel preview protection bypass header may be configured **server-side only** for development. Replace preview with permanent TrustLedger production base when released.
- Integration is pull-based. Push webhooks, partner SSO, key rotation/expiry policy, offline queue and message subscriptions require future implementation.

## Vercel project variables
- `SANDBOX_SESSION_SECRET`: sensitive 32+ random secret for encrypted connection cookies.
- `TRUSTLEDGER_API_URL`: exact HTTPS origin of TrustLedger preview or production deployment.
- `NEXT_PUBLIC_TRUSTLEDGER_DASHBOARD_URL`: direct browser URL for workers to open TrustLedger.
- `TRUSTLEDGER_PREVIEW_BYPASS_SECRET` (optional): private server-only Vercel deployment protection bypass used to contact the protected TrustLedger preview.

No environment variables should contain a user's connector API key. The user enters it via secure HTTPS only after creating the individual connector in TrustLedger.

## Verification
- `npm install && npm run typecheck && npm run build` within `abbis-sandbox/`.
- Manual end-to-end: create connector, connect, replay 4 observations, see acknowledgments, observe case in TrustLedger, submit worker investigation, supervisor review, refresh sandbox outgoing status.
- Permission boundary: source/facility must match the registered key; lost/revoked keys must fail to connect. No product release/discard decision is made by either service.
