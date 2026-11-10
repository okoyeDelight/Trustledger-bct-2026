# Research-backed Claude website production: original design, not generic AI templates

**Verified:** 10 Nov 2026. **Applied to:** existing TrustLedger browser-first synthetic clinical-operations product. Research is guidance; vendor skills are not silently installed. Use source URLs below to inspect upstream instructions and licenses before adding external code or hooks.

## Best research sources

1. **Anthropic, official `frontend-design`** — https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
   - Its guidance now emphasizes: plan a distinct design direction, critique against generic first instincts, make one element memorable while keeping other elements restrained, use plain product copy and validate rendered screenshots.
   - Use its thinking but preserve the existing TrustLedger brand, workflow and stack.
2. **Paul Bakaus, `Impeccable`** — https://github.com/pbakaus/impeccable
   - Project-aware design review, visual critique/audit, polish/adapt/typography commands, anti-template pattern scanning. Strongest match for **iterating an existing website**.
   - Origin article (reposted from X): https://www.paulbakaus.com/impeccable-by-design/
   - Presentation video: https://whobuilt.net/video/v42opQpCy60
   - If installed *by the owner* for Claude Code, use targeted passes: `/impeccable critique the TrustLedger Control room` → `/impeccable adapt the case workflow to 360px mobile` → `/impeccable polish the evidence-gap timeline` → `/impeccable audit`. Verify commands against the installed version; optional hooks/CLI can execute commands, so review before enabling.
3. **Damir Sokolovsky, `unslop`** — https://github.com/heydamir/unslop
   - Directly based on the “Unslopping” series on X; it identifies generic AI visual fingerprints, selects design character and iterates existing screens. Useful as an optional independent critique, **not a reason to radically restyle a nearly finished app**.
4. **NextLevelBuilder, `UI/UX Pro Max`** — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
   - Design knowledge base for type, palettes, patterns, UX/accessibility. It can be useful before first project styling but may otherwise add unnecessary complexity. It defaults to stacks such as HTML + Tailwind; **don't migrate TrustLedger from working vanilla HTML/CSS/JS**.
   - Example X post sharing it: https://x.com/linghucong/status/2007333077652304310
5. **`stop-design-slop`** — https://github.com/Juuzoe/stop-design-slop
   - Distinguishes objectively wrong artifacts from legitimate, coherent design choices. Useful as a check against knee-jerk removal of consistent fonts or cards purely because they're common.

**Important:** These resources are not guaranteed to work automatically in ordinary Claude web chat. Project-local `.claude/skills/**/SKILL.md` is primarily for Claude Code with access to a checked-out repository and skill discovery. A normal Claude chat with a GitHub connector might retrieve `CLAUDE.md` only if asked, but cannot be assumed to execute repository code or see screenshots. Give a direct request and verify tool permissions.

## Execution process for TrustLedger — no new app, no endless brainstorming

### Round 1: real audit
Read `CLAUDE.md`, `PRODUCT.md`, `CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `HANDOFF.md`, then inspect the current real app. Do *not* answer with a prompt and call that development. Compare 1440×900, 390×844, 360×800 actual screenshots and run the main scenario. The first screen should answer “What do we know? What is unknown? What does that change?”

### Round 2: create one original signature
The product's distinct design opportunity is a real **gap in evidence**, between reassuring observations, not a fake blood-drop ornament. Present a 4.2°C last value versus **57 source readings missing** with explicit blank time region, followed by a clear documented operator/reviewer flow and mock issue restriction. Keep the rest quiet, operational and uncluttered.

### Round 3: editorial craft
Ensure information hierarchy, readable numerical data, type scale, case severity, actual source/fiction provenance, useful whitespace, precise copy and clear focus indicators. Remove repeated generic eyebrow-card-CTA templates where they fail the specific workflow. Typography is a product tool, not a social-media style stunt.

### Round 4: critique like a real operator
Ask what happens to an incident that is missing evidence. Does the operator know the next action? Does the reviewer have the original source? Is mocked vs real unit mapping obvious? Can anyone misread an administrative resolution as clinical clearance? Are tap targets at least 44px? Is the navigation discoverable on a cheap Android phone? If any answer fails, fix it.

### Round 5: actually verify and ship
Run `npm test`, `python3 -m unittest discover -s tests -p "test_*.py" -v`, `npx playwright test`. Capture before/after screenshots from a browser with the real app—not generated images. Keep commit history and test evidence. Do not claim “premium” without observable results.

## The two supported ways to ask Claude to start

### Claude Code (project checkout, tools enabled)
Use a brief request (the local skill should trigger for frontend work):

> Start improving TrustLedger's existing website now. Read `CLAUDE.md` and use the project `trustledger-frontend-studio` skill. Inspect current screenshots, take a specific original design direction, implement the highest-impact mobile/desktop improvement in the real codebase, run all tests and show a GitHub commit/PR plus before/after images. No mockup-only output or fake backend.

If Impeccable has been deliberately installed in that Claude Code environment, add: `Use /impeccable critique and /impeccable polish on the first real screen; preserve our safe engine`.

### Regular claude.ai web chat with GitHub access
A local skill might not auto-trigger. Explicitly instruct Claude:

> Open the connected GitHub repo `okoyeDelight/Trustledger-bct-2026`. First read `CLAUDE.md`, `.claude/skills/trustledger-frontend-studio/SKILL.md` and `docs/CLAUDE_DESIGN_RESEARCH_AND_EXECUTION.md`. Then implement the first working frontend improvement in the existing site and verify browser screenshots/tests if your tools permit. If you cannot commit or test through this Claude chat, report the actual limitation rather than inventing results. Do not generate a new website or just give me a prompt.

## Collaboration and publication safety
- Team GitHub remains the source of truth. All work in authorized team repo with tested commits/PRs.
- Private repo history contains internal notes; NEVER auto-publish or change repo visibility.
- Claude and ChatGPT do **not** talk to each other directly. The shared files, commits, PRs, handoff and test results coordinate the work.
- Correctly distinguish actual CSV readings (facility level), added synthetic occupancy, mock roles, browser-local audit and export-only JSON.
- Submission is due 11 Nov 2026 12:00 EAT; focus on presentable genuine demo, not a visually impressive rewrite that breaks the workflow.
