# Session handoff — TrustLedger design

**Updated 10 Nov 2026.** This is a shared, repo-owned handoff; replace unverified claims with test evidence.

## Current known state
- Repository holds real vanilla JS application code and a responsive interface (`index.html`, `styles.css`, `src/*`).
- Engine unit checks passed in GitHub Actions as of inspection earlier today.
- A Playwright browser evaluator has been added to run on desktop and mobile. **Do not assume its full tests have passed**; inspect the latest Actions result.
- The design has not yet received a verified screenshot-based expert critique. Current CSS is an initial pass, not the target visual quality.
- Keep the application as a serious synthetic clinical-operations **simulation**, with no real donor/patient data.

## Design objective
Turn the current technical prototype into a top-tier, recognizable clinical operations experience. Prioritize the TL-024 missing-monitoring case as a memorable, unmissable visual proof point. Avoid copying a competitor's proprietary interface, adding unrelated pages, or dressing up the product with unnecessary 3D.

## Highest-priority next action
**Evaluator**: read the latest browser Actions logs. Fix infrastructure failures first, then launch a browser, run desktop/mobile journeys, capture screenshots, identify the biggest 3 UX issues. **Planner**: choose the smallest visual redesign that addresses those issues. **Builder**: implement without changing the safety engine. **Evaluator**: rerun and compare screenshots.

## Required reporting
At the end of each session append:
- Branch/commit and files edited
- Tests actually run and outcome
- Screenshots and locations
- Remaining UX or safety problems
- Next owner and exact next task
- Explicit unresolved assumptions; don't silently declare a pass

## Coordination
Our GitHub repo is the shared source of truth. ChatGPT and Claude do **not** directly chat with one another; independent agents coordinate through verified commits, GitHub PRs, this handoff and test results. Avoid competing edits to `main` without branch coordination.
