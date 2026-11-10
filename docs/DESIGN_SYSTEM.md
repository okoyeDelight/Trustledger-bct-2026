# TrustLedger — premium clinical-operations visual direction

## North star
**“A quiet, credible interface that makes uncertainty impossible to miss.”**
Design like a serious mission-control product, but for a human blood-service operator using a slow connection on a midrange Android phone. Not a generic AI dashboard, an overbranded marketing page, a Figma clone, or a hospital stock photo collage.

## Visual personality
- Editorial precision: strong but restrained typography, deliberate spacing, clear hierarchy.
- Dark ink / pine / teal on warm light neutrals; amber for missing evidence, muted coral for observed excursion, green only for limited positive status.
- Framing: very limited use of gradients and shadows. No glassmorphism on critical cards; accessible contrast and obvious clickable states.
- Prefer an operational *case study* above broad statistics. **Make 57 missing hours the protagonist of the demo.**
- One memorable visual metaphor: an **evidence ribbon** running normal readings -> disrupted 57h interval -> review gate -> simulated issue prevented. It must reflect exact data, not a fabricated smooth chart that conceals gaps.
- Legible dense tables with calm whitespace; responsive stacked layout rather than tiny shrinking cards on phones.
- Current repo uses Manrope and dark ink/teal; refine these rather than introducing five fonts.

## Suggested palette (starting point, verify contrast)
`#081F29` midnight ink; `#0F514F` deep teal; `#0D8179` primary teal; `#F3F7F5` soft neutral background; `#FFFFFF` surfaces; `#A36615` amber warning on pale `#FFF2D9`; `#AD4638` excursion on pale `#FBECE8`; `#557179` text secondary. Never use color alone.

## Page architecture
1. **Control room:** compact product identity and demo disclaimer, then a high-contrast *case hero* about the blind spot, queue of curated scenarios, clear case status and next action. Avoid overemphasizing vanity counters.
2. **Case detail:** a 4-part reading order: (A) observed evidence + unknown interval; (B) data quality conclusion; (C) possible inventory labelled supplemental synthetic; (D) two-role decision + mock issue consequence.
3. **Evidence lab:** explicit chart and comparison, latest-only 1/4 vs competent 4/4 vs TrustLedger 4/4, plus visible “no advantage over strong rules” caveat.
4. **Decision audit:** compact credible timeline. Distinct proposal, reviewer decision, mock issue event.
5. **Methods:** concise limitations/provenance panel; no claim of production security or real facility approvals.

## Interaction craft
- 150–220ms focus/hover transitions; 220–300ms route or card expansion only where legibility improves.
- Critical blocked mock issue: assertive but calm red/coral inline feedback, reversible to audit view. No shakes, explosions or confetti.
- Reviewer acceptance: quiet, clear status change and timestamp; do not celebratorily animate a real safety outcome.
- Evidence gap should remain a genuine chart gap, never visually interpolate readings across missing hours.
- Mobile navigation obvious and persistent enough to locate the review action; core tap areas >=44x44 CSS px.
- `prefers-reduced-motion: reduce` removes nonessential animation.
- Skeleton loaders only where real asynchronous loads exist. Current app uses local static data: do NOT add fake loaders.

## Deliverable definition
Claude must provide genuine before/after screenshots at 1440x900, 390x844, and 360x800; exact Playwright pass/fail, and specific fixes, not only an aesthetic description. Keep the existing app operational at all stages. Use `CONTRACT.md` as acceptance and `HANDOFF.md` for verified status.

## Git and 24h rules
Avoid overwriting changes from other agents. Build code only within the official 24-hour window. Do not copy implementation from another preexisting project. Third-party open-source dependencies are allowed under their respective licenses; treat unverified Twitter claims of “free” with skepticism.
