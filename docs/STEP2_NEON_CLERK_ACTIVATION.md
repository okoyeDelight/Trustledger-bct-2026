# Step 2 — Neon + Clerk activation checklist (TrustLedger only)
**Created 10 Nov 2026.** Status: **foundation only; NOT connected**. This is separate from StandPilot's Neon/Clerk instances.

## Done in code (feature branch)
- PostgreSQL migration: \`db/migrations/001_trustledger_core.sql\`
- Facilities and explicit three-role memberships, sources, imports, raw readings, incidents, evidence, event ledger and follow-up schema.
- Append-only incident event trigger (application-level integrity, NOT regulator-grade immutable evidence).
- Pure role/organization guards with regression tests.
- Server-only \`GET /api/me\` verifying a Clerk session JWT against its issuer JWKS and looking up **server-provisioned** active membership in a facility matching the session's active Clerk Organization.
- Explicit fail-closed result when secrets/database/account not configured.
- No external data ingestion or UI login yet; those are subsequent build tasks. No claim of real shared accounts until tested in two browsers.

## Required owner account setup (only through provider dashboards or connected provider apps)
1. Create a **new Neon project** named \`trustledger-incident-ops\`, separate from \`standpilot-conference-chat\`. Select a supported PostgreSQL region. Avoid copying any StandPilot database URL.
2. Apply the reviewed SQL migration to the new Neon database. Verify tables and indexes, and record execution results. Never run on StandPilot.
3. Create a **new Clerk application** named TrustLedger. Enable Organizations and restrict staff onboarding to authorized invitation flows. A production Clerk domain might require additional custom domain verification. Use the official Clerk docs; do not invent active staff accounts.
4. Configure Vercel project \`trustledger-bct-2026\` **server-only** variables:
   - \`DATABASE_URL\`: the **new** Neon pooled TLS connection string; secret.
   - \`CLERK_JWT_ISSUER\`: HTTPS Clerk Frontend API issuer origin (not a secret).
   - \`TRUSTLEDGER_APP_ORIGIN\`: \`https://trustledger-bct-2026.vercel.app\`.
   For future client UI only, \`CLERK_PUBLISHABLE_KEY\` is public and \`CLERK_SECRET_KEY\` remains server-only if needed. Never store actual values in GitHub, screenshots, or chat.
5. Create a Clerk organization for the **synthetic-only** facility. Retrieve only its opaque \`org_\` identifier. Provision \`facilities.clerk_org_id\` through an owner-controlled database migration/manual admin workflow, not through a public API.
6. Invite two test members in that Clerk organization: operator and **different** reviewer. Using their opaque \`user_\` identifiers, provision \`facility_memberships\` with appropriate roles in the database. Never allow a user to select their own role. Keep the admin role separate.
7. Verify \`GET /api/me\` in each authenticated account: correct role and facility; signed-out = 401; wrong organization/user = 403; no server vars = 503. Two browsers must see the same facility membership. No password or secret sharing.
8. Deploy only after preview build and tests pass. The existing public site remains the synthetic local-only prototype until a real shared workflow UI and API are implemented.

## Important limitations and security gates
- A Clerk token authenticates a person; DB membership authorizes their facility role. Neither is provided by a browser form.
- The **role policy utility is not yet a write-action authorization layer**. Future incident/ingestion endpoints MUST enforce it per request against the same verified user and facility.
- No real patient, donor, or facility data are authorized for this hackathon. The DB has a \`synthetic_only\` check; use only fictional records.
- \`source_imports\` stores file hash and metadata, not original file bytes. Upload/raw-object retention comes in Step 3, with private storage and content-size controls.
- No live device, blood-bank inventory system, monitoring feed, clinical release, or strong tamper-proof ledger is connected.
- Neon Free and Vercel Hobby are limited evaluation resources; assess actual usage, reliability, retention and hosting rights before real deployment.
- We do NOT have a connected Neon account in ChatGPT yet and therefore cannot honestly claim migration executed or account login verified.

## Release guard
Do not merge the feature branch into \`main\` until Neon and Clerk are configured, signed-out/role tests pass, and all existing evidence-engine tests remain green. The existing production link must remain available for the team.
