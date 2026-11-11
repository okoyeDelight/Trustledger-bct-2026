# TrustLedger — 3-minute judge demonstration
**Use the deployed build only; no simulated screenshots, no clinical claims.**

## Preparation (before recording)
- Log in as Facility Operator and Supervisor in separate browsers/private windows; never show usernames/passwords in a submitted video.
- Open the Proof Lab in one logged-in tab.
- Pick one clearly synthetic `INC-...` incident from the real incidents queue whose temperature history loads. Open its Evidence Passport.
- For an actual workflow demonstration, use a synthetic `REP-...` incident and distinct authenticated roles. Never create real donor, patient or facility records.
- The Proof Lab fixture examples are not stored in Neon. The versioned contract validator also never persists messages.
- Ensure mobile screen readability; keep notifications hidden. Rehearse once without editing the demonstrated outcomes.

## Scene-by-scene narration (aim 2:50)

| Time | Visible action | Narration |
|---|---|---|
| 0:00–0:20 | Home or Incidents | "Blood cold-chain teams have many alerts. A temperature dashboard can show an anomaly but not necessarily what is known, what is missing or who investigated it. TrustLedger adds that chain of accountability." |
| 0:20–0:48 | Proof Lab → deceptive green reading → Run | "Here the latest sensor reading is 4°C. But we have 57 unobserved hours. The actual timestamp-quality rule flags the gap. TrustLedger refuses to label the missing period safe." |
| 0:48–1:08 | Proof Lab → missing receipt → Run | "This unit was dispatched, but receipt is missing. Our custody rule will not invent its arrival or claim destination exposure." |
| 1:08–1:25 | Proof Lab → 99.9°C sentinel → Run | "A sentinel sensor value is not a validated extreme temperature. We exclude it from excursion evidence and flag its data quality." |
| 1:25–1:55 | Real incident → Evidence Passport → Inspect records | "This is an actual processed synthetic source incident, with original timestamps, quality status, candidate unit logic and explicit unknowns. The Passport is not a clearance certificate." |
| 1:55–2:27 | Worker case finding and supervisor review/history | "A facility worker records an investigation and submits it; only the distinct supervisor can review and assign follow-up. The event history records each handoff." |
| 2:27–2:44 | Proof Lab → contract: complete and missing timestamp | "This proposed versioned integration contract validates a complete record and rejects an incomplete one. We aren't claiming a real ABBIS connection." |
| 2:44–2:55 | Proof Lab closing caption | "Competent monitoring rules can also find these issues. Our added value is tracing evidence into accountable human action. Clinical decisions remain with authorized professionals." |

## What not to say
Do not say "AI predicted product safety", "blood units saved", "live fridge integration", "approved for transfusion", "FHIR/ABBIS certified", "statistically superior", "prevented wastage" or make unsupported claims about clinical outcomes.

## If time is short
Use the 57-hour gap, one Evidence Passport and one worker/supervisor handoff. Cut the other two scenarios and contract demonstration before cutting the final submission buffer.
