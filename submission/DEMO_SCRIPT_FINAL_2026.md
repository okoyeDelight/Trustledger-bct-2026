# Three-minute submission demo — actual API-connected TrustLedger
**Real self-service adapter and optional synthetic source demonstration. No live ABBIS or medical device.**

### First-time connector onboarding (show if time allows)
1. Quality Supervisor opens **Connections** → **Connect system**.
2. Register a clearly named synthetic integration (for example, `Hackathon-Sandbox`, facility `HSP-028`), generate a unique API key and copy it **once** to a secure credential store. The demo presenter must **not display the key** in a public recording.
3. Explain: partner systems use the key as `X-TrustLedger-Connector-Key`, send observations to `/api/connectors/v1/observations`, and read updates via `GET /api/connectors/v1/cases`. Source-system and facility scope are enforced.
4. Optional synthetic sender demonstration is under `Connections → Test with sample data`. It uses an authenticated operator login, not the newly generated partner key.

### Two-application connection (recommended opening)
- TrustLedger preview: `/connections` signed in as Quality Supervisor → **Prepare sandbox connector**.
- Exact source ID: `ABBIS-SANDBOX`. Facility: `HSP-028`.
- Create and copy the unique API key. **Never record or share its actual characters.**
- Open the **separate** source application: https://abbis-source-sandbox.vercel.app (Vercel protection may require login).
- Paste the key there; click **Connect to TrustLedger**. The source verifies the key through a genuine server-to-server HTTPS request.
- Press **Send four readings**. The sandbox sends four original synthetic source readings to the separate TrustLedger backend. Inspect acknowledged events.
- Return to the TrustLedger incident and have operator investigate and supervisor review it. Refresh the sandbox's **Investigation updates** section to see the returned live status.
- **Send again** demonstrates idempotent delivery, not a second case.

### Before recording
- Check that migration 004 has been explicitly approved and applied, new API deployment is READY, and synthetic-only demo account is logged in.
- Open the **Connections** page as Facility Operator.
- Supervisor logs into separate browser profile for the Review step.
- Do not show connector API secrets or real patient/donor data.

| Approximate scene | Live action | Explain briefly |
|---|---|---|
| 0–20s | Open Connections as Supervisor | "We designed TrustLedger as a cold-chain investigation component that can connect to external systems. For this demonstration ABBIS is a synthetic sandbox, not a real integration." |
| 20–55s | Press **Send readings to TrustLedger** | "These four historical readings are selected from the pinned hackathon CSV. The sandbox sends one genuine request per reading. TrustLedger validates and stores every received observation. The fourth consecutive above-6°C hourly observation creates an investigation candidate." |
| 55–75s | Press **Send again** | "Idempotent source IDs prevent duplicate observations and duplicate cases." |
| 75–120s | Press **Open investigation**, expand Evidence Passport | "The real case preserves original source IDs, readings and uncertainty. A worker submits findings. We don't invent refrigerator identity or blood-unit exposure." |
| 120–155s | Switch to Supervisor → Review | "An independent supervisor reviews the investigation, assigns follow-up, and can close it administratively." |
| 155–175s | Go back to Connections, **Refresh** | "The sandbox can read the same live case status through the authenticated return API. It does not return clinical clearance." |

### Key answers to judges
- **Is ABBIS connected?** No. ABBIS-like source data and connection are simulated. The TrustLedger ingestion API, append-only store, detection rule, case workflow and outbound status API are real.
- **What is the adapter interface?** Proposed `trustledger.observation.v1` JSON over HTTPS. `POST /api/connectors/v1/observations` accepts source-system ID, source-event ID, facility, explicit-offset timestamp and temperature. `GET /api/connectors/v1/cases/{reference}` returns case state and review-event types.
- **Machine authentication?** A configured connector-key header is supported in addition to a signed-in sandbox operator. A future institutional connection needs source-specific keys, facility authorization, managed rotation and audit policy.
- **How does detection work?** Four distinct consecutive hourly readings above the prototype 6°C threshold. Gaps and normal readings break streaks. No automatic clinical disposition.
- **How is the data realistic?** Historical supplied synthetic CSV records replay through real API calls. Original timestamps had no timezone and have an explicit artificial UTC offset for the sandbox transport demonstration.
- **Is output pushed?** No, currently an authenticated pull API; retries and webhooks are future work.

### Submission links
- Production (only after reviewed release): https://trustledger-bct-2026.vercel.app/connections
- Private GitHub: https://github.com/okoyeDelight/Trustledger-bct-2026
- Verification: `backend/tests/test_connector_replay.py`
