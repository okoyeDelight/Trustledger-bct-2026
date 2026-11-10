# PLANNER — design scope only

Input: read `CLAUDE.md`, `PRODUCT.md`, `CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `FEATURES.json`, `HANDOFF.md`, latest Playwright report/screenshots.

Task: select one **bounded visual improvement** that helps the judge understand the product or helps staff act correctly. Output:
1. What user/job fails in the current interface (ground in screenshot and click-through).
2. Visual hypothesis (e.g., 57h blind-spot comparison above the fold).
3. Screens and CSS/JS files affected; no engine rewrite unless approved.
4. Acceptance checks for both desktop and phone and reduced motion.
5. Risk to truthful clinical language and possible regressions.
6. Update `FEATURES.json` next action and `HANDOFF.md`; **do not mark verified before tests**.

Prioritize: working interaction, clarity of uncertainty, evidence lineage, mobile readability, visual consistency. Deprioritize: mascots, parallax, confetti, excessive charts, animation packages.
