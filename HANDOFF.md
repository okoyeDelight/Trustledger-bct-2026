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


## Verified build and visual review — 10 Nov 2026, 13:xx WAT

**Confirmed by the GitHub Actions browser evaluator:** [run 42815304722](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/runs/42815304722) on commit `5c038d1777c6158b4020dcff1ae5e63665286726`: **21 passed** (7 click-through/visual tests × 3 Chromium viewport projects: desktop, Pixel 7-like mobile, 360 × 800 mobile). Syntax/unit suite also passed: [run 42815304656](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/runs/42815304656).

**Screenshot evidence:** run 42815304722 artifact [trustledger-browser-evaluation](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/runs/42815304722) (artifact id `13763154796`). There are four full-page screenshots per viewport: control room before issue, blocked mock issue, evidence lab, and audit.

**Actual visual inspection by ChatGPT** of the desktop and 360px screenshots:
- Strong: cohesive serious teal/ink palette, readable contrast between latest 4.2°C and 57h gap, clear evidence/decision framing. No obvious global horizontal overflow at 360px; viewport automated check passed.
- Needs refinement: mobile header + page headline + hero consume substantial vertical space before user reaches case queue; a strong hero-action anchor mitigates this but the next review action is still far below. Horizontal nav truncates off-screen choices without an obvious scroll affordance. Some dense explanatory labels are only 9–11px CSS (especially charts, evidence cards, disclaimers) and should be raised where possible.
- Reviewer flow and mock issue controls are functional in automated tests. Tests verify behaviour, **not clinical validation, true human-role authentication or production-grade offline synchronization**.
- Focus-visible is styled, but no comprehensive screen-reader/contrast audit has been performed. Don't label accessibility complete yet.
- The screenshot captures show the actual rendered interface, not prompts or design mockups.

**Prior browser failure and fix:** earlier workflow 42812717597 failed only because a test counted 5 rows in `#benchmark-table`, but that selector targets the `tbody` with precisely 4 case rows. Fixed in commit `a9cd3fd8232bc72b7ce40fdc0425aaf2934a26ed`; current suite passes.

**Design additions already implemented:** the 57h evidence-first comparison hero, working case anchor, explicit form labels, 44px minimum interactive targets and reduced-motion fallback. All verified in the latest suite, including snapshots, not speculative implementations.

## Exact Claude design task — next owner: BUILDER / EVALUATOR
1. Read `PRODUCT.md`, `CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `roles/BUILDER.md` and `roles/EVALUATOR.md`; inspect the screenshot artifact above.
2. On a dedicated branch, improve mobile first-fold density: logo/nav height, page introductory headline and hero layout; ensure the first evidence action is visible sooner without sacrificing the 57h contrast.
3. Make hidden horizontal navigation discoverable or restructure it, and improve text readability in case/evidence cards. Keep all status phrases, provenance caveats, reviewer controls and the safety engine intact.
4. Run `npm test` and `npm run test:e2e`; review BEFORE/AFTER captures at 1440x900, 390x844, 360x800. The current desktop Playwright default is 1280×720; if 1440×900 captures are needed, add an explicit viewport test.
5. Record exact commands and browser artifacts in this HANDOFF file. Never claim visual or clinical sign-off on vibes.
6. Once organizer expert feedback or the meeting recording is actually accessible, review it and adjust workflow only on verified evidence.

**Urgent product action:** record demo and finalize up to eight slides before Wed 11 Nov 10:00 WAT; repo must be public by final submission. Solo/team approval must come from Hany; this development work does not settle roster status.


## Audio-level kickoff audit completed (10 Nov 2026)

**Source:** `docs/KICKOFF_AUDIO_REQUIREMENTS_AND_DECISIONS_2026-11-10.md` is based on a successful Descript timestamped transcription of the actual user-uploaded 35m36s kickoff. Inspect the meeting's Descript project for full context: https://web.descript.com/e189198b-2409-4b80-a35b-033c0e066c8a/a5dbd

**Changes to our priority:** Hany says video demo is the **first judging touchpoint** (~18:45), and judges want a working potential solution rather than a polished shell (~15:36). Another source says README first, so finish both. Stick to eight slides due written/oral limit conflict. Avoid spending more time on micro-animations until deployed URL, video, slides exist. Keep current workflow, but frame patient/clinical and facility status data strictly as synthetic. Her cited 2,119 synthetic at-risk issues is a candidate raw-data validation task, NOT a validated performance claim.

**Team issue:** no solo approval spoken in meeting. Hany promised follow-up by email; an end-of-meeting answer from the user indicated comfort with assigned team, despite later emailed solo request. Current roster remains pending organizer response; do not claim solo approval.

**Next owner:** Build/deploy owner: ship accessible hosted demo and record 3-minute walkthrough. Research/QA: verify longer baseline against supplied synthetic dataset; record failure modes. Designer: support clear captures, not a distracting redesign. GitHub repository remains private until visibility deliberately changed before final submission.


## New evidence from Hany: data cleanup explicitly counts (10 Nov)

Kickoff transcript at ~22:38–23:12: the organizers **intentionally made the synthetic data messy**; they count meaningful cleaning as hackathon work. We previously underweighted this instruction. Implementation added without broadening the one cold-chain workflow:
- `scripts/audit_starter.py`: source-preserving canonical ID names, documented sensor glitches `-99.0`, `99.9`, `0.0`, missing-hour ledger, missing blood groups, candidate-only donor duplicates.
- `tests/test_audit_starter.py`: no imputation, source retained, confirmed ID reconciliation, donor-not-merged checks; now tested in GitHub Actions `verify.yml`.
- `data/quality_audit_snapshot.json`: verified full original ZIP figures **55 glitches** (17 negative, 16 high, 22 zero), **387 gap intervals**, **12,273 expected readings absent**, **1,852 different facility-name strings** (not all spelling mistakes), **506 missing/unknown donor groups**, **442 request missing/unknown patient groups**, **452 candidate donor duplicate groups** (unconfirmed identities).
- `docs/DATA_QUALITY_PIPELINE.md`: methodology, exact commands and limitations. `README.md`: judging narrative.
- `src/engine.js`: corrected critical bug: treat the source-defined **0°C sensor glitch as untrusted** and not a verified observed excursion. Corresponding Node regression test.
- `index.html` Evidence Lab: source-backed audit summary and raw-vs-validated examples.

**Consequence for Claude:** present `raw source → validate/flag → reviewer decision`, not a generic "clean the data" badge. Show an actual raw value and transformed field; never imply inferred temperatures or verified equipment-to-unit links. Preserve all exact observed audit counts and their caveats. Broad model-training claims remain unsupported. Reproduce full audit by running script on provided external ZIP, not by relying only on screenshots.

**Verified CI:** `verify.yml` run [42820713434](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/runs/42820713434) completed successfully, including Node logic tests and Python cleaning regression tests. Browser evaluator run for the newest UI was in progress at the time of this handoff; inspect latest Actions before marking visual verification completed.


## Privacy-by-design scope (added 10 Nov 2026)
User supplied a KDPA/ODPC production checklist and asked what is actually relevant to our synthetic hackathon build. Source-checked with Kenya Law and ODPC. Added `docs/PRIVACY_BY_DESIGN_AND_DEPLOYMENT_GATES.md` including a **current-state data map**, realistic access/storage boundaries, documented missing security controls, legal gates for a future Kenyan health-provider deployment and the **section 43 correction: 48h processor-to-controller / 72h qualifying controller-to-ODPC**, not "36/72". Added `.gitignore` to reduce accidental future commits of credentials, raw archives, CSV exports, recordings and derived files.

**Do not claim KDPA compliance or ODPC registration.** Current app has simulated roles, browser-local editable audit and synthetic data, not clinical authorization or real RBAC. Real free-text can be typed in browser localStorage; warn users not to insert personal/health details. Third-party Google Fonts CSS may trigger external resource requests: not a no-network-requests design. Refactor or self-host only after testing a change and confirming browser improvements.

**Stay focused:** privacy-by-design slide/README note is enough for submission; consent logs, donor "My Data" screens, SMS/Oracle contracts, and real clinician access control are deliberately **out of hackathon MVP scope**.

**Next actual owner task (highest priority):** public HTTPS deployment (current repo is private and has no live URL). Then run e2e smoke-test on deployed URL, capture <=3-minute demo and compile eight pitch slides; prepare tonight's organizer check-in by **20:00 EAT (18:00 WAT)** and final submission Wed **12:00 EAT (10:00 WAT)**. Do not let paperwork displace the working demo.


## Scope is NOT frozen if evidence identifies a stronger problem
**10 Nov user direction:** discard weaker ideas if a materially stronger and more relevant opportunity emerges. Earlier “scope lock” documents are hypotheses, not binding commands. Follow the explicit evidence-led comparison in `docs/OPPORTUNITY_REASSESSMENT_2026-11-10.md`.

**New verified source finding:** `transfers.csv` has 35,181 transfers, **1,046 with blank received_at** linked to 1,046 actual synthetic `unit_id` values, of which **873 have a later retrospective status of transfused**. This is a missing documentation / traceability link, NOT proof of physical non-arrival, clinical harm, or an illegal issue. Sample `TRF-005463` linked to `U2511-NKR-006818-RBC`. The same transfer feed shows **zero** trip maxima above the dictionary's **>10°C** excursion threshold, so DO NOT invent a cool-box heat anomaly. This may be a stronger unit-level evidence story than the hypothetical fridge-to-unit mapping.

**Prototype direction to challenge:** a single **cold-chain + custody/provenance exception-to-human-review-to-mock-issue workflow**, with one strongly source-backed transfer receipt case and one monitoring-gap counterexample, if this stays comprehensible and is tested in time. Do not expand into all hospital inventory features or claim stock reduction. Do not automatically put real blood on clinical hold for missing receipt absent facility SOP. Preserve a working current demo as fallback.

**Official rule:** the assigned area (cold chain and data quality) cannot be switched to general forecasting/donor retention/redistribution after the Tue 14:00 EAT change window absent organizer permission. Keep proposed improvements within assigned scope.

**Next action for BUILDER/EVALUATOR:** assess whether one transfer provenance case can be fully wired to the existing human review/guard and tested *without sacrificing* deployment, 3-minute video, eight slides and final cutoff. If not feasible, stop feature expansion and submit current tested workflow honestly.


## Verified 10 Nov pivot experiment — missing records are NOT failed physical events

The user questioned whether a blank value in the supplied data proves a physical event was missing. Inspected the organizer's **actual synthetic `gen.py`** (lines 395–405). It computes an arrival, randomly omits `received_at` in approximately 3% of transfer records and still updates the unit's destination. **1,046 / 35,181** transfers have a blank `received_at`; 873 linked units have a **later retrospective status** of `transfused`. This is intentionally incomplete documentation, **not evidence of non-delivery, unsafe issue or clinical harm**. There are **zero** recorded trip temperatures strictly over the source dictionary's **10°C** threshold.

The same generator explicitly creates temperature logger-offline intervals (`gen.py` 381–386), leaving unseen measurements unknown, not inferably safe or hot.

**Decision after head-to-head evidence check:** Do **not** change the core product to “missing receipt stops all blood”. That would overclaim clinical significance. Retain the tested cold-chain-data-integrity → quality-review → MOCK issue-guard story, and preserve a source-backed transfer documentation **optional disclosure** in Evidence Lab. A receiving staff member may need to reconcile missing documentation, but there is no automatic clinical hold rule without an SOP.

**Implementation committed:** `scripts/receipt_provenance_audit.py`, `tests/test_receipt_provenance.py`, `data/receipt_evidence_snapshot.json`, optional UI `#receipt-evidence`, `docs/MISSING_DATA_EXPERIMENT_AND_DECISION_2026-11-10.md`, and mobile/desktop E2E tests.

**Claude guidance:** Never imply 1,046 units went missing physically, or 873 were unsafely transfused. Never describe the 57-hour logger gap as a confirmed temperature excursion. Refuse to infer device-level/unit exposures from facility-only source. Do not add an entire transfer management module now. Finish public hosting, demo video, slide deck, source provenance and real README accuracy.


## Five-grey-area closure verified; move to submission (10 Nov, afternoon WAT)

Summary: [docs/FIVE_GREY_AREAS_EVIDENCE_AND_TESTS_2026-11-10.md](docs/FIVE_GREY_AREAS_EVIDENCE_AND_TESTS_2026-11-10.md). The strongest source-backed case is **TL-NBO-HOT** with facility readings up to 7.9°C coinciding with source outage OUT-00009 (3.83h, no backup engaged). Case TL-024 shows 57 absent expected hourly readings; **do not fabricate outage cause for TL-024**. Both case types draw from source-generated `src/source_evidence.js`. Extra fictional unit/device occupancy in `src/custody_fixtures.js` is explicitly time bounded, never real exposure. A reviewer may document continued restriction or refer to site authority, but unresolved abnormal evidence is never mock-cleared. Whole-year descriptive counts are shown separately from four-case benchmark; no superior AI accuracy claims.

**Last verified browser run:** [42829892728](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/runs/42829892728), **39 passing desktop/mobile checks** across three Chromium viewport projects; GitHub Node and Python workflow tests pass. `README.md`, `PRODUCT.md`, `data/PROVENANCE.md` reflect these changes.

### New deployment staging (public exposure NOT yet authorized)

Added opt-in GitHub Pages workflow `.github/workflows/deploy-pages.yml` that deploys **only** `index.html`, `styles.css`, `service-worker.js`, and the four runtime `src/*.js` modules. It excludes internal `docs/`, `HANDOFF.md`, research meeting notes and other source files from the hosted *website bundle*. **The repo itself is still private**; enabling Pages and publishing the repository are distinct decisions. The repository contains internal kickoff discussion and roster concerns, so publishing its full history without proper permission/review would be inappropriate. Obtain explicit approval before changing repo visibility. Public source deliverable may require a separate sanitized repository or audited Git history, because deleting private notes in a new commit would not erase their commit history.

**Next:** Review public-sharing boundaries; configure GitHub Pages if user authorizes, run website-only deploy workflow, confirm public HTTPS works in unauthenticated mobile browser, then capture genuine ≤3min screen walkthrough and up to eight final slides. Submission due 11 Nov 10:00 WAT. No real health data or secrets are used.


## Frontend phase is active — keep the tested logic stable (10 Nov 2026)

**User decision:** team collaboration is established; proceed with WEBSITE/FRONTEND refinement. Be honest: the hackathon code is a deterministic browser-first prototype, NOT a production backend. Do NOT pitch server authentication, real fridge feed, immutable audit or database as implemented.

**Existing website:** `index.html` / `styles.css` / `src/app.js` — Control room, Evidence lab, Decision audit, Methods & limits, source-backed evidence hero, operator → QA simulation and mock issue guard. It is not a blank-slate design request. Aim for judge-friendly proof and high-craft usability, **not** a new React rewrite or feature sprawl.

**Screenshot insight:** the old 360×800 first viewport showed branding, nav and a large introductory heading but no 4.2°C vs 57h comparison. The frontend update reduces mobile header/introduction height and makes the hero claim precise: “A normal reading. 57 hours unknown.” `styles.css` and `index.html` changed; verify new browser screenshots/artifacts before declaring the fold solved.

**Frontend pass order:**
1. **Above-fold proof on 360×800:** the investigator can see *4.2°C vs 57h unknown* as soon as possible, with a 44px investigation CTA. Avoid confetti, heavy 3D and dashboard vanity stats.
2. **Real task usability:** TL-024 57h case and TL-NBO-HOT outage 7.9°C evidence, source/fictional custody provenance, operator proposal, reviewer Accept/Change/Reject, administrative outcome and mock issue state are readable and tappable.
3. **Explainable uncertainty:** never show a smooth temperature line across a gap, and preserve source-defined sensor glitches as raw/unknown. Every source unit/fridge association is clearly invented.
4. **Accessibility and African conditions:** 360/390px responsive, no horizontal scrolling, keyboard focus, readable type, reduced motion, visible labels, deterministic offline-capable logic. Do not assert offline multi-device sync.
5. **Evaluation clarity:** full-year dataset audit and four handpicked-case comparison must remain separate; 4/4 evidence feature **TIES** 4/4 competent rules. No made-up AI win or real patient outcomes.
6. **Submission readiness:** priority now is **safe public website hosting**, actual <=3 minute video and eight-slide pitch. Publishing Git history is a separate privacy/organizer issue. Repo remains private until explicitly approved.

**Change discipline for Claude/team:** Treat `src/engine.js`, `src/source_evidence.js`, `src/custody_fixtures.js`, and the Python source-analysis tools as *frozen contracts* for frontend-only design. Before changing them, establish a testable correctness bug and update tests. For visual-only changes, touch `index.html` and `styles.css`, and run the existing Playwright workflow. Never claim new backend/API/auth features without real implementation.


## 10 Nov afternoon update — concrete connected-systems demo, not pretend backend

`src/engine.js` now exports `buildHandoffPacket` for `trustledger.synthetic-handoff.v1`: exact source readings, power context, uncertainty flags, *fictional* unit occupancy, mock reviewer disposition and issue attempts. `src/app.js` adds real JSON download from any selected case. Tests in `tests/engine.test.mjs` and `e2e/core.spec.mjs` verify source fidelity, `clinical_release_authorized: false`, and `EXPORT_ONLY_NO_EXTERNAL_SYSTEM_CONNECTED`. It does NOT call an external hospital system. Frontend design may polish the new `.handoff-panel`, but do not add staff login UI without real authentication. Eight-slide factual pitch has been rendered in editable PPTX and PDF locally; source `submission/PITCH_8_SLIDES.md` remains the storyline. Still need public HTTPS demo, recorded screen video, organizer-approved public code access.
