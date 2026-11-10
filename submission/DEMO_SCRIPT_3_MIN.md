# TrustLedger — 2:50 real-screen demonstration script

**Status:** Shot list and voiceover; not yet a recorded video. **Requirement:** ≤3 minutes. **Source:** Actual tested website, not mock-up or pre-rendered fake screens. All showcased information is synthetic.

| Time | REAL screen / action | Narration guidance |
|---|---|---|
| 0:00–0:20 | Open control room; display latest 4.2°C vs 57 missing hours | “Blood banks cannot judge cold-chain safety from the latest normal temperature alone. In the organizer's synthetic data, a facility's readings resume after 57 expected hourly measurements are absent. We cannot know the conditions during that interval.” |
| 0:20–0:40 | Scroll evidence timeline and missing-hours note | “TrustLedger preserves the raw record, distinguishes observed readings from missing evidence, and triggers investigation rather than inventing what happened.” |
| 0:40–1:00 | Open Evidence Lab; show 381/387 gap finding and data-quality audit | “We also ran a reproducible cleaning analysis on the full supplied dataset: 387 monitoring gaps; 381 resume at an in-range reading. We flag 55 documented sensor glitches and preserve original values.” |
| 1:00–1:22 | Return Control room; choose RBTC-NBO recorded excursion and power outage | “For another case, we joined two actual synthetic data feeds: temperature readings up to 7.9°C coincide with a 3.83-hour facility power outage with no backup engaged. That's useful context, not proof a specific unit was exposed.” |
| 1:22–1:38 | Scroll labelled synthetic candidate unit timeline | “The starter dataset does not contain device-to-unit occupancy history, so candidate unit links here are explicitly additional fictional demo records. In production, we would need verified equipment and custody timestamps.” |
| 1:38–1:53 | Attempt mock issue; show BLOCKED toast | “A simulated issue attempt is blocked while evidence is unresolved.” |
| 1:53–2:16 | Complete operator proposal, reviewer Accept/Change/Reject (one), record reason | “The operator proposes an action. A separate simulated quality-review step records the human decision and rationale. The model does not authorize clinical release.” |
| 2:16–2:35 | Document review closure / refer to site authority; retry issue, remains blocked | “Even when review documentation is closed or escalated, the mock restriction stays enforced; missing evidence is not equivalent to clearance.” |
| 2:35–2:50 | Show audit, download synthetic handoff JSON and conclude | “TrustLedger turns evidence into accountable review, an enforced mock restriction and a downloadable synthetic handoff record. No real hospital system is connected; clinical benefit is not yet proven.” |

## Recording quality rules
- Total final runtime under 180 seconds with some margin. Avoid sped-up interactions that cannot be followed.
- Capture actual deployed HTTPS product and the screen action results. No synthetic screenshots masquerading as running software.
- Use legible 390px/mobile and/or desktop recording, large enough text, no personal phone notifications.
- For demo, fill rationale with synthetic sample text; don't enter a real patient's or staff member's identity.
- Show exact original records and source clearly. “Power outage overlaps observations” is not “outage caused specific unit's exposure.”
- Before recording, use Reset demo to ensure the operator and reviewer flows are visibly fresh; test once.
- Do not add an unsupported “X units saved” or “AI reduced loss Y%” statement.

## Critical caveat for narrator
The app currently uses **simulated operator/QA roles and a browser-local audit**, not production authentication. A competent gap-aware rule monitor catches these same gaps; our unproven additional value is tying evidence to accountable human review and a mock issuing guard.
