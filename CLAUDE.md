# TrustLedger — Claude coding and design briefing

Read `PRODUCT.md`, `CONTRACT.md`, `FEATURES.json`, and `HANDOFF.md` before editing. For visual design, read `docs/DESIGN_SYSTEM.md`. This repo belongs to the Terumo BCT Africa Hackathon 2026. Work only within the official build window and with organizer-approved team arrangements.

## Frontend studio skill — user may now simply ask you to start

The repo now contains project-local `.claude/skills/trustledger-frontend-studio/SKILL.md` and research `docs/CLAUDE_DESIGN_RESEARCH_AND_EXECUTION.md`. **Read and execute them whenever the user asks you to start, continue or improve the website.** Do not respond with a generic frontend prompt or a speculative new app; inspect and improve the actual working UI, run tests, and commit verified changes. The project skill is self-contained. If official Anthropic frontend-design or community Impeccable is already installed and reviewed, use its critique/polish ideas as supporting guidance; don't automatically download external hooks/packages or assume they are installed. Ordinary Claude web chat with a GitHub connector might not auto-load local skills or support running/committing code; be accurate about that limitation.

**Preferred first task:** compare real 360px and desktop screenshots, fix the clearest issue in the existing mobile Control room and source-evidence timeline. A 4.2°C latest reading alongside 57 missing hourly records is the signature; preserve all operating decisions and source truth. Keep public-hosting, demo-video and deadline priorities visible.

## Your assignment
Make the **existing** one-workflow TrustLedger product look and feel exceptional on **phone and desktop**, while retaining exact evidence logic. You are refining a real interactive app, NOT inventing a landing-page concept or rebuilding a flashy medical SaaS brochure.

## Unbreakable rules
1. Preserve existing case IDs, synthetic evidence, test assertions, operator -> reviewer -> mock issue guard flow, local audit, and honest baseline.
2. Original dataset is **synthetic facility-level readings**; synthetic `DEMO-*` unit and `FR-*` links are added demo fixtures. Never imply true unit exposure or real clinical authorization.
3. Normal latest temperature with 57 missing expected hourly observations must remain visibly unsafe-to-assume, and simulated issue must stay blocked absent review.
4. No real transfusion clearance, blood compatibility, stock release, patient/donor messaging, or health claims. No unapproved external service calls or real data.
5. Mobile-first, browser-accessible, performant, and legible. Prefer purposeful animation to decorative effects. Respect `prefers-reduced-motion`.
6. Avoid adding React, a full design editor, Three.js, Blender, GSAP, or paid APIs merely to improve styling. Current stack is HTML/CSS/vanilla JS; only add a small, justified dependency if needed.
7. **Never claim the browser has been tested unless you actually run it**. Update `HANDOFF.md` with what was tested, any failing selectors/screens, next work.

## Workflow
- PLANNER: `roles/PLANNER.md`; propose one bounded feature/change and acceptance criteria in `FEATURES.json`.
- BUILDER: `roles/BUILDER.md`; implement it on a focused GitHub branch, preserve the engine, and run unit tests.
- EVALUATOR: `roles/EVALUATOR.md`; start local server, click through with Playwright on desktop and phone, inspect screenshots and accessibility, report failures.
- Repeat until the current task is genuinely verified. Do not call something `done` without evidence.
- `npm test` runs the decision engine unit checks.
- `npm run test:e2e` runs the browser test suite (after `npm install` and browser installation).
- Static app: `python3 -m http.server 8080`, then open http://localhost:8080.
- Existing GitHub Actions workflows run Node engine tests and Playwright browser checks.

## Repo etiquette
- Read the current branch and latest commits before modifying shared files. Do not overwrite other contributors' changes.
- Preserve `src/engine.js` unless a real failing test requires a reasoned, separately reviewed change.
- Prefer updating CSS, layout and component markup in `styles.css`, `index.html`, and `src/app.js`.
- Keep reviews separate from builds where possible. Report exact commands, screenshots and failures. No fabricated test results.
