# PRODUCT DECISION — TrustLedger, not a general blood-bank management platform

**Decision date:** 10 Nov 2026 (24-hour Terumo BCT Africa Hackathon technical phase).  
**Purpose:** Give Claude, Isaac, Admire, judges, and all collaborators ONE unambiguous brief.  
**Status:** Product direction locked for MVP; pending organizer guidance on officially approved roster. This document is not a claim of clinical expert validation.

## One-line positioning
**TrustLedger is the evidence-to-decision safety layer for blood cold-chain incidents.** It finds what a temperature feed does NOT prove, preserves source quality/provenance, routes uncertain cases to qualified human review and demonstrates a mock inventory issue restriction.

**NOT:** a general blood bank, full donor management, SMS alarm dashboard, standalone temperature predictor, FHIR implementation, forecasting tool, or actual clinical transfusion system.

## One user, one moment, one outcome
**Primary user:** Blood-bank duty operator, with a quality reviewer as required second role.

**Trigger:** A synthetic refrigerator/facility monitoring interval contains an observed breach, documented sensor glitch, duplicate timestamp, or a missing period that a normal latest reading hides.

**Job to be done:** Establish what evidence exists, what remains unknown, which **illustrative synthetic** unit-location records are candidates (if such records are supplied), request qualified disposition, record human sign-off, and prevent an unreviewed MOCK issue attempt.

**Visible outcome:** A simulated unit on hold cannot pass the issue desk without the appropriate reviewed disposition. This does **not** establish actual unit exposure, safety, clinical release, or transfusion compatibility.

## A seven-step judge demo
1. Open incident TL-024. Latest temperature **4.2°C** appears normal.
2. Inspect timeline: **57 expected hourly measurements are absent** across the 58-hour interval in the original synthetic facility feed. Explicit UNKNOWN, not safe or unsafe by inference.
3. Inspect raw and validated source fields. A known source-dictionary sentinel such as **99.9°C or 0°C** is flagged as an unreliable sensor value, **not a confirmed thermal excursion**. Show full-dataset audit: 55 defined glitch rows, 387 gap intervals, 1,852 facility-name differences reconciled by stable ID, donor identity candidates left unmerged.
4. Investigate candidate unit(s). **DEMO-* unit ↔ FR-* links are supplemental invented test fixtures.** Real source has facility-level temperatures, no named-fridge/unit timeline. Clearly label that constraint.
5. Attempt mock issue: BLOCKED due to incomplete or abnormal evidence; audit the attempt.
6. Operator proposes hold or investigation with evidence note; simulated quality reviewer Accepts / Changes / Rejects with rationale; persist local audit.
7. Attempt mock issue again. Hold remains enforced. Show a limited clean-control case mock-permitted only after a simulated reviewer decision. Explain actual blood release always requires site-specific SOP and authentication absent here.

## Why this is a stronger 24h strategy than BloodLink

**Isaac's BloodLink proposal** covers collection/testing/storage/issue/transfusion/disposal, temp alerts+SMS/WhatsApp, demand forecasting, redistribution, FHIR REST API and offline synchronization. Each is a separate engineering and clinical workflow, with additional datasets, security and validation. Under a strict 24h window, shallow demonstrations risk failing the main working-prototype and technical-depth criteria. BloodLink's temperature alerts are also not a distinctive answer to *missing/invalid* evidence.

**Admire's proposal** describes essentially the SAME cold-chain investigation concept as TrustLedger: detect anomalies, validate temperature/inventory records, identify candidates, support staff review. We agree with its problem selection. It is at the right problem level, but it is not sufficient differentiation by itself. TrustLedger must supply the stronger **testable outcome** (issue restriction + human decision history), evidence labels, source-backed data-quality work, explicit 57-hour counterexample and full end-to-end browser test.

### Selective adoption from both
- **Adopt:** small event history for a unit at the relevant control points (received/stored, evidence review, hold, mock issue attempt). NOT a complete collection-to-transfusion platform.
- **Adopt:** strong data-quality cleaning that preserves raw fields, joins canonical names by stable IDs, flags 0/-99/99.9 synthetic sentinels and missing hourly intervals, and preserves unknowns. This directly responds to Hany saying the data was deliberately messy and cleanup counts as hackathon work.
- **Adopt:** meaningful offline-fallback and mobile affordance. Currently basic local state + cached shell, NOT tested multi-device sync.
- **Adopt as future architecture:** standards-based API / FHIR mapping only after expert-confirmed requirements and actual security model; no false interoperability claim.
- **Defer:** SMS/WhatsApp integration, forecast/expiry optimization, redistribution, donor recruitment, patient portal, full stock lifecycle and autonomous medical release. These create extra incomplete workflows and weaken the core demo.

## Competitive distinction: what judges can see
- An ordinary alert says, “last temperature normal” or “temperature crossed threshold.”
- A competent rules monitor ALSO catches gaps and glitches. The current four curated cases show **no improvement over a competent rules baseline** (both 4/4); TrustLedger must NOT claim model accuracy superiority.
- Our **hypothesized added value** is *data-to-action closure*: detect uncertain evidence → explain precisely why → preserve chain of evidence → request review → log decision → enforce a simulated issue gate. This claim is about operational workflow, NOT a trained AI's predictive superiority. It should be evaluated with an honest comparison to a competent rule monitor plus manual ticket workflow. No validated workflow improvement measurement exists yet.
- One memorable hook: **“The reading is normal. The evidence is not.”**
- Show the source-dictionary **0°C sensor sentinel** as a counterexample of falsely classifying a glitch as a real excursion.

## Uncomfortable truths / failure gates
1. Real historical unit-to-named-fridge mapping **does not exist in the starter dataset**. Do not assert “these specific real units were exposed.” If the clinical experts say that site-specific SOP or mapping is unavailable, demonstrate “cannot determine / review” instead.
2. Actual app has **hard-coded curated case fixtures** and a separate offline cleaning script. The full cleaned data pipeline is not yet dynamically wired into all UI decision states.
3. The reviewer roles are SIMULATED; audit is browser localStorage and mutable; the app does not authenticate an authorized clinician or stop real hospital software.
4. The repo is PRIVATE and public hosting has not been confirmed. Final submission must include a public working, judge-accessible URL/code path as prescribed by organizers.
5. Four demo cases are not a scientifically independent evaluation. Strong rules baseline ties the feature. Need reproducible broader dataset audit and/or fair task comparison without fabricated claims.
6. Live expert/user workflow validation remains missing; avoid asserting actual lifesaving outcomes.
7. Work within the official time window and document contributions / AI tool use truthfully.

## Priority decisions under the official rubric
Official technical brief: **25 working end-to-end**, **20 architecture/technical**, **15 AI/data**, **15 real blood-user fit**, **15 African constraints/scaling**, **10 demo**. Which means working case-through-review-through-guard and verifiable data cleaning rank ahead of new cosmetic pages or forecast modules. The judge's kickoff narration says the short video may be their first touchpoint; make both README and video immediate and consistent.

**Next actions by priority:**
1. Keep one product name and shared source of truth: `TrustLedger`.
2. Deploy the current tested static app to HTTPS, ensure repo can be reviewed publicly by submission without exposing secrets.
3. Close one provenance-to-UI story: raw source/validated value and candidate-unit uncertainty explained at click-time; consider making the cleaning output consumable by demo only if realistic before cutoff.
4. Reproduce a small honest evaluation against a baseline that includes a competent rules + ticket process; never fabricate superiority.
5. Record genuine <=3 minute live walkthrough and create **eight** evidence-rich slides; complete all submission links and organizer check-ins.
6. Work through shared GitHub commits/branches with assigned team members rather than introducing parallel feature fantasies.

## External ideas attribution
This document compares proposals supplied by the user: an Isaac-proposed general blood-bank system named “BloodLink”, and an Admire-proposed cold-chain evidence-to-review concept. We should discuss participation/credits fairly with confirmed team members; product scope is a team collaboration decision, not proof one person owns the idea.

## User-facing language (safe)
> TrustLedger is a cold-chain evidence and decision-support prototype for blood-bank operations. Instead of simply alarming on unusual temperatures, it identifies when monitoring records cannot support a reliable conclusion, highlights possible inventory consequences, and guides a documented human review that controls simulated issuing. All data and units are synthetic; no clinical disposition is automated.
