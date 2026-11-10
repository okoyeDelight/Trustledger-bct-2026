# BUILDER — focused implementation

Input: approved feature and acceptance criteria in `FEATURES.json` + all contract/doc files.

1. Read current main branch and recent commits, create a focused branch and avoid conflicts.
2. Inspect current HTML/CSS/JS; do not replace working app with static marketing mockups.
3. Implement only the approved slice, preserving actual click handlers, engine safety rules, timestamps, synthetic provenance and accessibility.
4. Use custom CSS and light inline SVG if necessary. Introduce Lucide/Motion only when it materially improves clarity; document dependency and offline behavior. No Figma clone, Three.js, GSAP + Motion duplication or massive asset packs.
5. Run `npm test` and `npm run test:e2e`, or report exactly why any check was not run.
6. Provide screenshots for evaluator; do not self-certify aesthetics without seeing a rendered view.
7. Update `HANDOFF.md` and `FEATURES.json` with implementation state, commit, known limitations and pending tests.
