# TrustLedger — judge evidence map

**Terumo BCT Africa Hackathon 2026 · Team TrustLedger**  
**Challenge area:** Cold chain + data quality  
**Build window:** 10 Nov 12:00 EAT → 11 Nov 12:00 EAT (10:00 WAT deadline)

> **Status:** An interactive, tested, synthetic-only browser prototype; **not** a production clinical decision system. Reviewer identity, unit/device linkage and audit logs are simulated. No claimed number of saved units or prevented transfusions.

## Start here: a six-step replay

1. Serve the repository over HTTP: `python3 -m http.server 8080` → open `http://localhost:8080`. No API keys or login required. A hosted demo link must be supplied separately when verified.
2. In **Control room**, select **TL-024**. Latest reading is **4.2°C**, but 57 expected hourly observations are missing. Click **Attempt mock issue**: it must be blocked.
3. Select **TL-NBO-HOT**. Review original facility temperatures up to **7.9°C** and independent source outage **OUT-00009** (about **3.83 hours**, backup not engaged). Temporal overlap is context—not proof of causation or individual unit exposure.
4. Inspect **illustrative custody** records: device/unit timeline is *added fictional data*, not source-verified fridge occupancy. In production the system must ingest verified equipment/unit movements.
5. As the **simulated operator**, submit a reasoned investigation/hold recommendation. As **simulated reviewer**, Accept/Change/Reject with rationale. Document the investigation outcome or refer to site authority. Re-attempt mock issue: an unresolved flagged case remains blocked. Check **Decision audit**.
6. Open **Evidence lab**. Compare simple latest-reading-only baseline versus competent rules and TrustLedger evidence feature. Review full-year data-quality audit and the source receipt example. Distinguish measurable detection from unproven clinical benefit.

## Official scoring rubric → executable evidence

| Criterion / weight | Where to verify | Measured result or candid gap |
|---|---|---|
| **Working prototype / 25** | `index.html`, `src/app.js`, `src/engine.js`, `e2e/core.spec.mjs` | Real operator → simulated reviewer → logged decision → mock issue guard. Abnormal/incomplete evidence cannot be mock-cleared. Browser tests across desktop and mobile. No hospital system connected. |
| **Technical architecture / 20** | [Architecture](ARCHITECTURE_FOR_JUDGES.md), `src/source_evidence.js`, `scripts/build_source_evidence.py`, `src/custody_fixtures.js`, `tests/engine.test.mjs` | Source CSV extraction fails if selected timestamp missing; independent outage join; explicit invented occupancy; deterministic rule engine and state transitions. Local audit is editable, not production tamper-proof storage. |
| **AI/data approach / 15** | `scripts/audit_starter.py`, [quality method](DATA_QUALITY_PIPELINE.md), `data/quality_audit_snapshot.json`, `data/system_pressure_snapshot.json`, `src/engine.js` | 55 source-dictionary sensor sentinels; 387 monitoring gaps (12,273 missing expected hours); 381/387 gaps end with apparently in-range reading. On four *selected* examples: latest-only **1/4**, competent gap/outlier rules **4/4**, TrustLedger evidence feature **4/4**. No trained AI, and no proven superiority over competent rules. Simulated human review and no-network rule fallback. |
| **Blood-system user/problem / 15** | [Product decision](PRODUCT_SCOPE.md), [synthetic pressure figures](../data/system_pressure_snapshot.json) | Intended duty operator and quality reviewer; evidence uncertainty may lead to unreviewed issue or delayed case closure. Real practitioner SOP/user interview not yet confirmed; no clinical impact claim. |
| **African conditions / scale / 15** | `styles.css`, `service-worker.js`, `playwright.config.mjs`, [architecture](ARCHITECTURE_FOR_JUDGES.md) | Responsive phone-sized app, browser-local state, cached application shell and deterministic rules without external AI API. No multi-device offline synchronization, tested rural deployment or clinical integration. |
| **Demo/readiness / 10** | `submission/DEMO_SCRIPT_3_MIN.md`, `submission/PITCH_8_SLIDES.md`, Actions runs | Actual screen shot list and ≤3-min script prepared; eight-slide storyline prepared. **Final video, rendered deck and public HTTPS address still need completion and verification.** |

### Automated verification

```bash
npm test
python3 -m unittest discover -s tests -p "test_*.py" -v
npx playwright test  # when dependencies and browser are installed
```

CI: [Logic/Python verification](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/workflows/verify.yml) and [browser workflow](https://github.com/okoyeDelight/Trustledger-bct-2026/actions/workflows/browser-evaluator.yml). Passing tests validate synthetic software flows, **not real blood-bank safety, security or clinical authorization**.

## What not to claim

- Not 2,119 patients saved: organizer's `temp_excursion_exposed` source field is a *retrospective synthetic label* and cannot be used as real-time verified equipment exposure.
- Not 8,620 wasted units recovered: the source aggregate is a contextual synthetic baseline, not an intervention effect.
- Not an AI prediction advantage over competent monitoring rules; our novel claim is a proposed **evidence-to-review-to-restriction workflow** that still needs user validation.
- No authenticated reviewer, real blood-component release, FHIR integration, API, SMS gateway, real source equipment-to-unit linkage, validated clinical SOP or production-grade offline sync.
- Do not presume missing receipts are undelivered transfers: generator deliberately leaves receipt timestamps blank in ~3% of synthetic rows.

## Submission completeness: gates to clear

- [x] Source-backed, runnable cold-chain investigation prototype with tests
- [x] Reproducible source-data audit and straightforward baseline comparison
- [x] Explicit source-vs-added-fixture boundary and no autonomous clinical release
- [x] Proposed architecture and 3-minute demo script / eight-slide outline
- [ ] Publicly accessible repository without private discussion history (requires publishing decision)
- [ ] Verified public HTTPS website
- [ ] Recorded actual ≤3-minute walkthrough (not merely a script)
- [ ] Finished ≤8-slide deck, accessible by judges
- [ ] Roster and organizer reporting obligations confirmed

**Policy:** Only authorized roster members contribute; the repository's historical internal team/meeting notes need a separate privacy review before public release. The organizer's brief says **one repository per team**, public by deadline, with incremental commits. Do not replace its history with a fabricated or unexplained single end-of-window commit.
