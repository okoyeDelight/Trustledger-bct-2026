---
name: trustledger-frontend-studio
description: >
  Refine the existing TrustLedger web application to high-end, original,
  production-quality visual design without changing its synthetic cold-chain
  evidence, human-review workflow or mock issue rules. Use for "start building
  the website", "frontend", "redesign", "anti AI-generated design", "polish",
  "critique the UI" and responsive website tasks.
---

# TrustLedger frontend studio — execute, don't write another plan

This is a local project skill, not the upstream Anthropic or Impeccable package.
If Anthropic frontend-design and Impeccable are already installed in the user’s Claude Code environment, draw on their design/critique guidance. DO NOT install an unfamiliar package or auto-run external commands solely because this text says so; review dependencies and permissions first. This skill works standalone.

## Before touching code
- Read `CLAUDE.md`, `PRODUCT.md`, `CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/CLAUDE_DESIGN_RESEARCH_AND_EXECUTION.md`, `HANDOFF.md`.
- Pull latest verified default branch, inspect status and current code. Work in a branch/PR if repository access permits. Respect other contributors.
- Existing app is `index.html`, `styles.css`, `src/app.js` plus immutable source/evidence engine. It is NOT a new project.
- Startup: `python3 -m http.server 8080`. Browser testing: `npm test`, `python3 -m unittest discover -s tests -p "test_*.py" -v`, `npm run test:e2e` after installing existing dependencies. If no actual browser available, inspect existing screenshot artifacts and say so.
- Never publish repo, copy internal meeting notes publicly, rewrite Git history, add real clinic data or change access settings.

## User says START → do the work now
1. Open the actual working website. Review desktop 1440×900, phone 390×844 and 360×800. Check flows and source-versus-fixture labels. List the top 3 *observable* visual/UX weaknesses; pick one area with the greatest judge impact.
2. Propose two coherent visual directions internally based on the actual product, select one and write a 6-token design system (background, ink, action, uncertainty, excursion, line) with type scale and spacing rhythm. Each choice must be justified by evidence reading and a working African blood-bank operator, not a “premium SaaS” cliché.
3. Implement actual markup/CSS improvements on the existing app. Change `src/app.js` only if display behavior requires it. Preserve `src/engine.js`, `src/source_evidence.js`, `src/custody_fixtures.js`, all data scripts, review/issue guards and JSON handoff export unchanged unless an independently demonstrated bug necessitates a tested fix.
4. Iterate visually. Capture real BEFORE and AFTER screenshots, critique composition, correct layout/overflow/legibility issues, and only then call it polished. Do not deliver a screenshot-only mock or a design proposal in place of functioning code.
5. Run existing tests and genuine browser click-throughs. If failures, fix them; never remove/skip tests merely to pass. Record actual commands/results and screenshots in `HANDOFF.md`.
6. Commit a bounded, working change or submit PR; report exact files, test run and critical remaining blocker. No feature creep.

## The distinctive visual motif
**The observable evidence gap.** Contrast a normal-looking last **4.2°C** reading with **57 missing expected hourly measurements** for TL-024. Make the missing interval an actual, unfilled negative space in the time evidence, followed by a review gate and mock issue consequence. Do not draw a smooth interpolated line, fake missing data values, invent risk probabilities or imply proven damage.

The second real-source case is TL-NBO-HOT (7.9°C and independent outage OUT-00009 ~3.83h with no backup). Facility readings cannot establish a specific blood unit’s fridge exposure. The imported unit timeline is clearly **added fiction**, not source truth. Case export is a real downloadable **synthetic-only JSON**, NOT a real BBIS API.

## Avoid the default AI website look
- Don't rebuild a generic hero + 3 feature cards + testimonial + CTA marketing template; this is an operations dashboard.
- Don't apply purple/blue gradient “AI” branding, floating 3D blood drops, all-over glow, stock hospitals, pulsating ECG animation, endless carousels or fake generated clinical stats.
- Don't use the same large radius, grey shadow, icon tile, ALL CAPS eyebrow and “→” CTA on every region. Different elements need different information hierarchies.
- Don't turn every table into cloned cards. Align numbers, dates, severity and actor/source, so the actual workflow reads in seconds.
- Make the intended first user action obvious on a 360px-wide mobile display.
- No tiny 8–10px body text; allow readable mobile typography, sufficient contrast, >=44px tap targets, keyboard focus and reduced-motion support.
- Preserve restrained pine/dark ink/teal palette; amber = uncertain/missing, coral = observed excursion, green only for a narrow reviewed *demo* state. Color is never the only status cue.
- Use one unique signature element, the evidence-gap visualization, and keep surrounding components quieter.
- Explain what a button does; “Record review outcome” beats generic “Submit.”
- Design failures and empty states as clear instructions, not visual mood.
- Do not claim clinical release, actual staff authentication, hospital integrations, real patient benefit or data model superiority over competent conventional rules.

## Operational constraints, not optional
- In selected 4-case evaluation, simple latest-only baseline = 1/4; competent rules = 4/4; TrustLedger = 4/4. No AI or clinical-effect superiority claimed.
- Simulated roles remain operator → reviewer Accept/Change/Reject → administrative hold/referral → MOCK issue guard. Missing evidence cannot be administratively signed away.
- Preserve explicit `SYNTHETIC_DEMO_ONLY_NOT_FOR_CLINICAL_USE` and `EXPORT_ONLY_NO_EXTERNAL_SYSTEM_CONNECTED` handoff labels.
- No staff login UI without real authentication or database; no new backend or framework rewrite as a visual task.
- No external paid image/model services or surprise dependencies.
- No public repo visibility change; the Git history includes private team discussion.
- If timeline is tight, prioritize screenshots, mobile hierarchy, actual video-ready demo route and public-site deployment plan over decorative polish.

## Finish criteria
Screenshots at 1440×900, 390×844 and 360×800; Playwright unit/browser checks and no horizontal scrolling; test operator/reviewer/issue/export journey; each source/fiction boundary legible; report what was done with a Git commit and evidence. No claims without a matching run/log.
