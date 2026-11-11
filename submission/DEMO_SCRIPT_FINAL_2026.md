# TrustLedger — concise end-to-end demo script (about 3 minutes)

**Main idea:** show a proposed ABBIS-connected cold-chain component, not an isolated testing dashboard. The connector is simulated and requires a signed-in demo operator; no real ABBIS data is exchanged.

## Before recording
- Open the latest deployed website in two browser profiles, one Facility Operator and one Quality Supervisor.
- Never expose passwords or real blood-bank identities.
- Keep `/connections`, `/incidents`, `/review` ready. Use synthetic fixture `SYN-ABBIS-ALERT-001`.
- If this synthetic event was imported previously, the "Send again" button will return **Already received**, which is an intended idempotency proof. You can reuse the existing case.

| Time | Screen | What to do and say |
|---|---|---|
| 0:00–0:25 | **Connections** | "TrustLedger is a cold-chain investigation component for a proposed ABBIS ecosystem. The external feed here is simulated, not an existing ABBIS connection. This synthetic alert starts at 7.2°C." |
| 0:25–0:47 | **Receive sample alert** | Press **Receive sample alert**. "Our authenticated adapter validates the versioned input and creates a durable provisional incident. If we send the same source event again, no duplicate is created." |
| 0:47–1:15 | **Open investigation → Evidence Passport** | "This case keeps its original source system, event ID, observation and explicit uncertainty. A single observation is not proof of sustained exposure, and we don't invent a fridge or blood-unit association." |
| 1:15–1:50 | **Worker** | Record a synthetic finding ("Checked the sample; device and duration are unverified"), then submit the investigation. "The operator records what was checked; they cannot sign their own independent review." |
| 1:50–2:22 | **Supervisor → Review centre** | Switch to supervisor, find the case, accept/return the investigation flag with a reason. "Review is an administrative investigation decision, not approval for transfusion." |
| 2:22–2:42 | **Connections → Refresh status** | "The same case reference returns the latest investigation status, review events and no clinical clearance. An external system could consume this contract once formally integrated." |
| 2:42–2:55 | **Closing** | "TrustLedger connects source evidence to an accountable human response. A conventional temperature monitor can also detect abnormal readings; our added hypothesis is case traceability and handoff quality, which needs field evaluation." |

## Optional questions from judges
- **How is this interoperable?** The `trustledger.observation.v1` payload is validated through `POST /api/integrations/demo/observations`. The case and its status are retrieved through `GET /api/integrations/demo/cases/{case_reference}`. This is a versioned proposed contract and a functional same-origin *simulation*, not an authenticated third-party ABBIS adapter or standards-certified exchange.
- **What prevents duplicates?** A stable case ID derived from source-system and source-event IDs; conflicting reuse of an event ID is rejected with HTTP 409.
- **Where are the records?** The bridge stores exceptional source events in the existing append-only staff-report storage as separately labeled `EXT-` cases (no schema migration); notes, reviews and case history remain in Neon.
- **How is this safe?** Unknown device identity and product exposure stay unknown. No clinical release or discard decisions exist.
- **Can it process routine telemetry?** Not yet. This demonstration retains incident-producing observations only, not an entire external temperature feed.
- **Can you test edge cases?** Yes. The legacy hidden `/proof-lab` technical page offers three executable synthetic cases for optional deeper inspection.

## Submission links
- Live site: https://trustledger-bct-2026.vercel.app
- Current connected workflow: https://trustledger-bct-2026.vercel.app/connections (once merged and deployed)
- Private source code: https://github.com/okoyeDelight/Trustledger-bct-2026
