# UI and engineering contract (designer / builder / evaluator)

## Preserve behavior
- `TL-024` produces a **57 missing-hour** evidence finding even though the newest reading is normal.
- `TL-NBO-HOT` contains a recorded excursion; `TL-NBO-GLITCH` preserves raw 99.9°C but marks it implausible.
- Only the intentionally limited `TL-024-CONTROL` may receive `mock_clear`, and only after operator proposal and reviewer acceptance. A mock issue for flagged evidence must remain blocked.
- `DEMO-*` candidate units are **supplemental synthetic** fixtures. Avoid language implying verified physical exposure.
- Reviewer must have genuine Accept/Change/Reject buttons and documented reason, not a decorative mock control.
- Existing comparative outcome must stay visible: on four manually selected demo cases the latest-only baseline correctly flags 1/4; the competent rules baseline and TrustLedger evidence feature each flag 4/4. **No superiority over competent rules is established.**
- Browser localStorage is not secured auth or a production audit store; display role simulation labels accurately.

## Visual acceptance criteria
- Desktop viewport 1440x900: queue, evidence and primary consequence visible without overwhelming chrome.
- Mobile viewport 390x844 and 360x800: no global horizontal overflow; queue, graph, select, input and issue button usable; no text truncated; navigation functions.
- Consistent eight-point spacing grid, disciplined typography, accessible status labels (icon + words, never colour alone), strong contrast.
- Focus indicators and keyboard/tab sequence usable; inputs have visible labels; at least 44px tap targets for core controls.
- Do not animate status changes until after successful state transition; honor `prefers-reduced-motion`; keep motion approx. 120–260ms.
- Offline shell loads after prior cache visit (when supported); data reasoning remains deterministic with no AI network dependency.
- Loading, empty, validation, error, decision success and blocked outcomes must have honest UX. No confetti around blood safety decisions.
- Distinguish “possible candidate due to illustrative fixture” from “confirmed affected unit”; do not imply missing data = excursion or safe.

## Tests that must pass
1. `npm test` all engine tests.
2. `npm run test:e2e` on Chromium desktop and Pixel-like mobile.
3. Screenshots reviewed at 1440x900, 390x844 and 360x800, including visible issues and after-fix evidence.
4. A simulated issue attempt for the gap case is blocked before and after an authorized hold.
5. A clean control is blocked before reviewer sign-off, and mock-permitted only after.
6. Evidence lab documents comparison with no fabricated performance claims.

## Definition of done
A reviewed screenshot and browser pass are **required**. A screenshot-less guess, a visually impressive prototype without working buttons, or a fabricated benchmark is not a pass. Record the exact observed outcome in `HANDOFF.md`.
