# TrustLedger — ready-to-adapt submission answers
**Synthetic prototype, November 11, 2026. Replace any wording required by the application form.**

## Name
TrustLedger

## One-line summary
Evidence-linked blood cold-chain incident investigation with accountable worker–supervisor review.

## The problem (84 words)
Blood services rely on temperature logs, movement records and human investigations to protect a sensitive supply chain. A normal temperature reading can hide hours of missing observations, and a destination field may not prove a unit arrived. Dashboards can surface alerts, but a team still needs to establish which evidence supports each case, what remains uncertain, and who investigated and reviewed it. Unclear provenance and undocumented handoffs can make an incident harder to understand. TrustLedger focuses on that evidence-to-action gap.

## Updated real adapter proof (final submission wording)
TrustLedger exposes an actual versioned JSON/HTTPS integration gateway. A Quality Supervisor can register a partner source and facility, generate a secure API key that is displayed once, verify it and revoke it later. API keys are stored only as SHA-256 hashes, with source- and facility-scoped permissions. The optional ABBIS-like sandbox reads original synthetic records from the provided dataset and sends four chronological observations through the same HTTP ingestion API. TrustLedger stores each event in an append-only ingestion ledger, rejects duplicates and conflicting retransmissions, and creates a provisional investigation case only after four consecutive above-threshold hourly readings. The existing worker, supervisor and audit workflow remains real. An authenticated return endpoint exposes the latest case status to a connected system. The source platform and sensor are simulated; the TrustLedger APIs and persistence are not. This is a proposed integration contract, not a live ABBIS interface, and it does not make clinical decisions.

## The solution (135 words)
TrustLedger processes a pinned synthetic dataset of facility temperatures, blood-unit transfers, inventory and power outages. Deterministic checks identify provisional out-of-range events, missing readings and candidate custody overlaps without inventing refrigerator-level attribution. Each incident contains an Evidence Passport: observed source records, quality flags, uncertainty, candidate-unit reasoning and the case's human investigation history. A facility worker can report an incident, record findings and submit an investigation; a separate supervisor reviews the flag, assigns follow-up and closes the administrative case after the worker's actions are complete. All transitions are recorded in append-only Neon events under a restricted database role. A Proof Lab lets judges execute three adversarial cases and compare them fairly with competent conventional rules. A real versioned observation endpoint, scoped API credentials and a read-only case-status endpoint demonstrate software-to-software integration; no real ABBIS deployment is connected.

## Technical approach (87 words)
Next.js 16 provides a mobile-responsive interface; FastAPI and Python/pandas implement deterministic source validation, incident grouping and conservative facility-level matching. Six supplied synthetic CSV sources are pinned by Git revision and byte/hash verification before processing. Neon PostgreSQL stores incident reports, investigation notes, review events and append-only case transitions. Demo identities have distinct worker and supervisor permissions. GitHub Actions checks Python tests, frontend type/lint/build and source pipeline reproduction. The original dataset is processed in a reproducible batch, while incoming source observations are accepted individually through authenticated APIs into an append-only store. This is not live telemetry from real devices; institutional identity, data agreements, facility-level staff isolation and expert clinical validation remain prerequisites.

## Why this is distinct
The differentiated hypothesis is not superior anomaly detection. A competent conventional monitor can detect gaps and invalid readings too. TrustLedger links that evidence to explicit uncertainty, documented human decisions and a case history in one investigation workflow. Whether that improves speed, accountability or patient outcomes requires independent measurement.

## Real-world relevance and future integration
Designed as a practical precursor for connected blood-bank infrastructure in settings with variable data quality and connectivity. A proposed `trustledger.observation.v1` JSON validation contract demonstrates the failure boundary for incomplete events, including missing timezone-aware timestamps. It can ingest and acknowledge external JSON observations, enforce per-connector source/facility scope and return case statuses by API, but there is no live ABBIS integration, formal HL7/FHIR mapping or third-party clinical deployment. Before piloting: negotiate data agreements, validate site SOPs and temperature rules, add real sensor identifiers, confirm custody and unit association, implement scoped institutional accounts and independently evaluate results.

## Reproducible evidence
- Real connector onboarding: one-time API key generation, scoped inbound HTTP observations, outgoing authenticated case-status feed, and append-only revocation.
- Optional executable Proof Lab fixtures: 57-hour gap, missing receipt and sensor sentinel.
- Both TrustLedger rules and a competent comparator flag all three hand-designed fixtures; this is not a sensitivity estimate.
- Incident Evidence Passport shows source rows and handoff log.
- Two independent authenticated HTTP sessions have been exercised by automated tests; the restricted Neon role has been tested separately.
- No blood product is automatically released, discarded, declared safe or approved for transfusion.

## Links
Website: https://trustledger-bct-2026.vercel.app
Connections: https://trustledger-bct-2026.vercel.app/connections (after release of the connector branch)
Optional adversarial tests: https://trustledger-bct-2026.vercel.app/proof-lab
GitHub: https://github.com/okoyeDelight/Trustledger-bct-2026
Demo script: `submission/DEMO_SCRIPT_FINAL_2026.md`

## Submission honesty checklist
- No unsupported "AI accuracy", "blood units saved", "clinical approval", "live sensor", "ABBIS integration" or "offline writes" claims.
- Do not describe the three scripted fixture cases as representative outcomes.
- Do not submit patient, donor or real operational data.
- Confirm collaborator permission for any unlicensed upstream material reused in submission materials.
