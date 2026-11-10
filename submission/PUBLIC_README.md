# TrustLedger
### Cold-chain evidence → human review → simulated issue control

**Terumo BCT Africa Hackathon 2026 · Team TrustLedger**  
**Challenge areas:** Cold chain and data quality  
**Prototype:** static, synthetic-only web application. **Not validated clinical software.**

> **The reading is normal. The evidence is not.** A recent in-range refrigerator temperature cannot establish what happened during 57 missing hourly measurements. TrustLedger makes that uncertainty visible, guides documented staff review and demonstrates a mock unit issue restriction.

## Fastest way to judge this working prototype

```bash
# No API key, external service or installation required for the web app.
python3 -m http.server 8080
# Open http://localhost:8080
```

In the **Control room**, choose **TL-024**. The latest reading is **4.2°C**, but **57 expected hourly readings are absent**. Try **Attempt mock issue**: blocked. Propose a hold or investigation as the *simulated* operator. Have the *simulated* quality reviewer Accept/Change/Reject and document the outcome. Try mock issue again: unresolved evidence remains restricted. Check the browser-local **Decision audit**.

Next choose **TL-NBO-HOT**: an original synthetic 7.9°C facility reading overlaps independent source outage `OUT-00009` (~3.83 hours; no backup engaged). A source join is not proof of causation or actual unit exposure.

In **Evidence lab**, view a source-preserving audit, the full-year monitoring gap result, the four-example baseline comparison and a separate transfer-documentation investigation.

## Implemented exchangeable case record (synthetic only)

Each investigation now offers a real downloadable JSON packet (`trustledger.synthetic-handoff.v1`) with original-source facility temperature observations, data quality findings, linked synthetic source power outages, explicitly fictional inventory candidates, reviewer outcomes and mock issuing status. This is *export only*, not a hospital-connected interface; it is not FHIR, real user authentication, clinical release authorization or a production inventory write. See `src/engine.js` function `buildHandoffPacket` and `e2e/core.spec.mjs` browser download test.

## Judging criteria: evidence, not marketing

| Official criterion | Weight | Proof here |
|---|---:|---|
| Working end-to-end prototype | **25** | `src/app.js` + `src/engine.js`: two simulated human steps, investigation documentation, mock issue guard and audit; `e2e/core.spec.mjs` |
| Technical depth / architecture | **20** | [Actual architecture](docs/ARCHITECTURE_FOR_JUDGES.md), source CSV extraction with fail-closed checks, deterministic state logic, browser tests |
| AI and data approach | **15** | Reproducible synthetic data cleaning, strict raw/sentinel handling, gap baseline, honest non-ML classification; [method](docs/DATA_QUALITY_PIPELINE.md) |
| Blood-system problem/user | **15** | Named blood-bank duty operator and quality reviewer; uncertainty about monitoring evidence and inventory consequence; [scope](docs/PRODUCT_SCOPE.md) |
| African conditions / scale | **15** | Responsive mobile UI, locally cached first-party shell, no required remote inference; production sync not yet built |
| Demo and presentation | **10** | [≤3-minute real-screen script](submission/DEMO_SCRIPT_3_MIN.md), [eight-slide outline](submission/PITCH_8_SLIDES.md), repeatable actions/tests |

This package contains a **recordable demo script** and a **slide outline**, not a fabricated finished video or deck. Public live-site, video and final slide links should be added only after they have been verified.

## Original synthetic dataset: findings

The organizers deliberately added data quality defects. Our reproducible analysis of the supplied **synthetic** year found:

- **399,280** facility temperature records with **55 documented sensor sentinel values** (`-99`, `99.9`, `0°C`).
- **387** logger monitoring gap intervals, totaling **12,273** missing expected hourly readings. In **381** intervals, the first recorded value after the gap was inside the illustrative 2–6°C range. Missing hours remain unknown.
- **1,852** request facility-name strings different from verified canonical facility names (including harmless case/abbreviation differences).
- **506** donor records with missing/unknown blood group, and **452** groups of *candidate* duplicate donors, **not automatically merged**.
- **1,046** synthetic transfers with a blank receipt timestamp; the source generator explicitly omits approximately 3%. This **does not prove non-delivery** or clinical harm.

For the original data-quality procedure, see `scripts/audit_starter.py`, `scripts/system_pressure.py`, `scripts/receipt_provenance_audit.py`, and the [data audit report](data/quality_audit_snapshot.json). The organizer's full ZIP is not bundled; download it separately from the official Applicant's Kit to reproduce the full scan.

## Comparative evaluation, without overclaiming

On **four intentionally selected** demonstration cases (three review cases, one negative control):

| Method | Correct cases | Interpretation |
|---|---:|---|
| Latest-reading-only threshold | **1/4** | Does not consider missing history |
| Competent temperature + gap + glitch rules | **4/4** | Baseline already catches the problems |
| TrustLedger deterministic evidence rule feature | **4/4** | **Ties competent rules**; no accuracy improvement shown |

These are smoke-test annotations, not a held-out study or validation of clinical outcomes. **No trained AI model is in the critical path.** The hypothesized addition is the explanation → simulated reviewer → recorded decision → mock issue restriction workflow; the improvement over a competent existing case-management process remains to be tested. Rule checks operate without any AI service or network connection.

## Technology, architecture and limits

The actual application is HTML/CSS/JavaScript modules with localStorage, a small service worker and original-source excerpts generated offline with Python. Review actions, role labels, unit mappings and issue attempts are **simulated**; the local audit can be edited. No hospital systems, device SDKs, authentication, server database, SMS, FHIR API or medical release decisions are integrated.

Original source monitoring is **facility-level**, not named-fridge-to-unit occupancy. `src/custody_fixtures.js` contains time-bounded **fictional** unit/device examples; no genuine unit exposure is inferred. A real clinic would need verified fridge/unit history, a responsible quality professional and a local SOP before making any disposition.

## Tests

```bash
npm test
python3 -m unittest discover -s tests -p "test_*.py" -v
# Browser evaluation, after Playwright dependencies installed:
npx playwright test
```

See `.github/workflows/verify.yml` and `.github/workflows/browser-evaluator.yml` for automated checks. Tests verify application behaviors, not patient safety or regulatory compliance.

## AI-use disclosure

**ChatGPT (GPT-6)** assisted with research, design, code drafting, deterministic logic, tests, source analysis and technical writing. **GitHub Actions** runs automated checks; it is not an AI model. **Claude** was discussed as a potential design/coding collaborator but is **not claimed** as an author of this submitted code unless a team member documents actual use. Everything in this submission must be explainable by authorized roster members.

## Team, submission and provenance

- **Team:** TrustLedger. Confirm official roster and any contribution changes with the organizer; do not invent names or approval.
- **Development window:** 10 Nov 2026 12:00 EAT to 11 Nov 2026 12:00 EAT.
- **Provenance:** Original CSVs and source-generator findings are synthetic; added custody fixtures are explicitly identified. The public-facing package is a curated set of project files; the original incremental development history remains in the private team development repository and must be made verifiable to organizers according to their instructions.
- **Deployment and clinical boundary:** Never use this tool to decide whether real blood is suitable for transfusion.

For a detailed criterion-by-criterion map, see [Judging evidence](docs/JUDGING_EVIDENCE_MAP.md). For data lineage and technical limitations, see [Provenance](data/PROVENANCE.md) and [Architecture](docs/ARCHITECTURE_FOR_JUDGES.md).
