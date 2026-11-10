# TrustLedger product brief — design-focused

## Product thesis
**TrustLedger makes the uncertainty in blood cold-chain evidence visible before a simulated unit issue can proceed.** An operator sees the evidence and proposes an action; a quality reviewer authorizes or rejects; the mock issue guard respects that control. This is a synthetic prototype, not a clinically validated product.

## Intended users
1. Blood-bank duty operator investigating a temperature event or monitoring outage.
2. Quality reviewer deciding an evidence-based human disposition and recording why.
3. Issue-desk user simulating whether a mapped demo unit is restricted.

## The one journey that must shine
**Incident TL-024:** Two normal-looking facility temperatures are 58 hours apart, leaving 57 expected hourly readings absent. A naive latest-reading view seems reassuring. TrustLedger shows a visually clear **57h evidence gap**, distinguishes what is known and what is unknown, lists only explicitly labelled **supplemental synthetic** candidate units, asks for an operator recommendation, routes it to a reviewer, logs the reviewer decision, and blocks the **simulated** issue. A clean negative-control case is optionally mock-cleared after reviewer sign-off. Do not call this patient protection proven.

## Current code
- `src/engine.js`: evidence classification and review/issue rules.
- `src/app.js`: interactive case and navigation logic.
- `styles.css` and `index.html`: existing visual interface.
- `tests/engine.test.mjs` and `e2e/core.spec.mjs`: engine and browser checks.
- `data/PROVENANCE.md`: source transparency.
- `docs/PRODUCT_SCOPE.md` and `docs/TEST_PLAN.md`: intended capabilities/acceptance plan.

## Desired design outcome
A polished, distinctive **mission-critical operations interface**, not a generic AI startup dashboard. The design should feel credible to a blood-service professional and instantly comprehensible to hackathon judges. The strongest design moment should be a comparison:
- **What the last reading tells you** — looks normal.
- **What the timeline actually proves** — 57 hours of unknown conditions.
- **What the accountable next step is** — review and simulated issue restriction.

## Deliverables for visual refinement
- Cohesive desktop + mobile visual system with legible hierarchy.
- Responsive review queue and focused case detail.
- Evidence visualization with legible intervals and a truthful chart of missing/implausible readings.
- Visually unmistakable operator/reviewer roles and decision results.
- Mock issue stop/permitted feedback and clear persistent local audit.
- Small, purposeful transitions and disabled/reduced-motion alternatives.
- Actual desktop/mobile browser screenshot review, fixes, and evidence.

## Hard deadline and judging
Official technical brief: one end-to-end workflow, a human in control, honest numeric data-feature vs baseline, working fallback, diagram, README and <=3-min video. Working prototype receives 25 points, architecture 20, AI/data 15, user/blood context 15, African conditions 15, demo 10. Eight slides is safest because written sources conflict (up to eight vs 8–10).

Not in scope: predicting compatibility, clinical blood release, donor outreach, 3D cinematic mascots, video editor, Canva/Figma clone, complex machine-learning claims, or wide multi-product platform.
