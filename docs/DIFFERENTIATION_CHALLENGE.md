# Differentiation challenge — judge-visible outcome, not AI theatre

**10 November 2026 · Design challenge / hypothesis · Not proven user benefit or clinical validation**

## 1. Critical lesson from the World Bank comparison

Earlier private DESPRIX research compared Care Handoff with the publicly documented Vitamin Bob winner. Vitamin Bob's strong documented trait was a single demonstrable journey: basic-phone missed call → district callback → bounded symptom intake → rule-based next step and human routing, supported by small, disclosed comparisons against a keyword baseline. Judges' private reasons are unknown; DO NOT assert this is why it won. Care Handoff's technical controls were strong but real-device end-to-end validation and a readily legible user outcome were weaker. See original private research: `desprix-terumo-bct-2026/research/WINNER_COMPARISON.md`. Do not copy either app's code into this official timed-build submission.

**Accepted lesson:** show an action that visibly changes at the end of one realistic user journey.

**Discard:** adding voice, blockchain, AI chat, fabricated clinical thresholds, invented beneficiary interviews, or superficial copying of the winner.

## 2. Strongest story within the approved one-workflow scope

**Hook: A unit is being prepared for a simulated issue, and the latest temperature looks normal—yet the facility has a 57-hour monitoring gap. Is it appropriate to trust that latest value?**

1. Operator tries to review synthetic unit/candidate inventory for issue.
2. A basic current-temperature-only display appears normal (document exactly what it reports; do not misrepresent a robust competitor).
3. TrustLedger shows **COLD-CHAIN EVIDENCE UNVERIFIED** and the missing interval; does not infer that blood was either safe or actually exposed.
4. It opens one incident case with original readings, gap duration, outage context and source timestamps.
5. It distinguishes facility-level **candidate inventory** from *confirmed* units. A named-fridge assignment requires a clearly labelled additional synthetic location-time fixture. Without this fixture, do not say an individual unit was definitively affected.
6. An operator assembles evidence and proposes a simulated hold or request for investigation.
7. An authorized quality reviewer must review with rationale (Accept / Change / Reject), and a **mock issue gate** respects a recorded hold; reviewer action cannot silently claim real clinical clearance.
8. All decisions, corrections and unknowns are available in an audit timeline. Test manual/rule-only fallback with explanatory AI off.

**Complementary adverse case:** a solitary 99.9°C / -99°C synthetic sensor sentinel surrounded by plausible measurements. TrustLedger should not silently treat it as a genuine excursion or automatically assure safety: show "implausible reading — verify sensor and evidence". Demonstrate lower overreaction without hiding uncertainty.

**Important:** Case selection and user burden need practitioner validation. This is a demonstration with synthetic data, not evidence of actual staff pain or prevention of unsafe transfusion.

## 3. Differentiator hypothesis, not claim of novelty

The project is **NOT** "AI that predicts a hot fridge." It is **evidence-quality-aware incident-to-authorized-decision coordination**, including the *consequence* of missing/conflicting evidence at a simulated unit-issue checkpoint. The innovation hypothesis is reducing false confidence and review overhead, relative to strong conventional procedures. Audit trails, quarantine controls and alarms already exist; do not imply invention or universal uniqueness.

## 4. Hard tests that could DISPROVE this direction

- **B1 naive display/threshold:** detects out-of-range valid readings but may fail on missing data; quantify precisely on same cases.
- **B2 strong conventional baseline:** detects missing/implausible data, uses a standard case/ticket and role-based approval. This is the real competitor. If TrustLedger is no better on *case completion, traceability, steps/time or uncertainty correctness*, we must not claim technical superiority.
- **Fixed scenarios:** verified excursion; 57h monitoring gap; implausible spike; overlapping outage; optional missing transfer receipt; no historical fridge record; reviewer rejection and hold enforcement; disabled LLM; narrow-screen/offline if implemented.
- **Safety invariant:** No unknown inferred safe, no automated clinical release/discard, no unauthorized simulated issue of held unit, no original-data tampering, no hidden status-label leakage.
- **Metrics:** evidence-source completeness, correct unknown classification, reviewer completion, number of user actions, elapsed completion time if honestly timed, audit fidelity, simulated hold-gate violations. Publish actual sample sizes, failures and unchanged baselines. No fabricated percentages.
- **Kill condition:** unable to demonstrate case→human authorization→mock issue guard, or no verified user value; remove optional AI/extra features before diluting the core workflow.

## 5. Judge-visible demo sequence (target <=3 minutes)

0:00–0:20 Show a unit-issue attempt with a seemingly normal *latest* reading.
0:20–0:50 Reveal the 57-hour missing interval and "UNVERIFIED" status.
0:50–1:25 Open evidence case, distinguish observed and unknown, show possible inventory / synthetic fixture provenance.
1:25–2:00 Operator proposes and authorized reviewer decides; show persistent audit.
2:00–2:30 Attempt simulated issue of held unit → refused; turn AI explanation off and show same safety gate.
2:30–3:00 Show honest baseline table, one failure case, and narrow Africa-ready architecture note.

This is an outline, not a verified working demo. Change timing and claims to match implemented functionality.

## 6. Priority decision

**Keep single cold-chain exception-to-unit review workflow**, but present its consequence at the simulated issue checkpoint. This is a tighter story, NOT an additional inventory-management workflow. Do not change the written product scope until Isaac confirms engineering feasibility and clinical reviewer assumptions are checked. Decision: conditional pursuit / subject to tests.
