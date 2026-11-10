# TrustLedger: problem-to-outcome thesis after re-reading the kickoff and Technical Phase Brief

**Date:** 10 November 2026. **Evidence type:** actual 35m36s kickoff transcript + official Technical Phase Brief (9 Nov) + original synthetic starter dataset. **Status:** scope recommendation; future benefits NOT measured.

## Why the hackathon exists, not just what feature to build

Hany's kickoff (transcription in user's private Descript project) repeatedly frames an end-to-end African blood-system problem:
- ~11:53–13:00: blood collection, testing, storage and movement can be inefficient; excess collections and wastage exist alongside unmet needs. General **motivation**, not a direction to build all modules.
- ~13:01–15:38: solve **one real problem for one named blood-system user**; cold chain and data quality are among multiple permitted areas.
- ~20:10–22:38: all teams share the same *synthetic* year of facility/drives/donors/units/transfers/requests; narrative examples of **~23% RBC/WB waste**, **2,119 retrospectively temperature-exposed units marked transfused**, **~5h emergency resupply** and **~6 in 10 donor records classified students**. All synthetic, not live Kenyan statistics.
- ~22:38–23:12: deliberately messy input, and meaningful cleanup counts toward work.

The **official brief** says (paraphrase, not an audio quotation): one 24h workflow, not a whole blood-bank information system. **Cold-chain target:** spot fridge/cool-box temperature problems, list potentially affected units and stop them reaching patients. **Data-quality target:** identify duplicates, missing fields and implausible data, and help staff fix them. Qualified person accepts/changes/rejects, data feature vs baseline, fallback, diagram, <=3min demonstration, README.

**Decision:** Focus on cold-chain incident resolution + evidence quality; let the wider wastage and shortage pressures explain the importance of resolving incidents promptly. Do not silently change area to forecasting/donor retention or claim those are solved.

## Verifiable synthetic problem sizing (original ZIP)

Reproduce using `python3 scripts/system_pressure.py --source '/path/to/Hackathon Starter Dataset.zip'`. Stored aggregate snapshot `data/system_pressure_snapshot.json`.

| Synthetic source outcome | Count | Correct interpretation |
|---|---:|---|
| RBC + whole-blood units in `units.csv` | **37,147** | Scope of denominator |
| Expired RBC/WB | **4,901** | One type of wastage; not all preventable by cold-chain review |
| Discarded due to recorded temperature outcome, RBC/WB | **3,719** | Another loss type; recorded retrospective result, not evidence of preventability |
| Total wasted RBC/WB | **8,620 (23.21%)** | Expired + temperature discard in synthetic model |
| All components labelled both `temp_excursion_exposed=True` and `status=transfused` | **2,119** | Model's retrospective units, NOT confirmed real harm or automatic prospective exposure knowledge |
| Hospital requests not `fulfilled` | **2,241 / 17,430 (12.86%)** | Unmet, partial or deferred requests; shortage context |
| Donor records classified student | **25,182 / 43,363 (58.07%)** | Donor reliance; some duplicate candidate records, and share alone does not prove month-by-month shortage |
| Emergency requests externally resupplied with a recorded ready time | **1,796**, median **5.20h** | Conditional subset with externally supplied emergency blood; not median all requests |
| Facility temperature gap intervals | **387**, missing **12,273** expected hours | Missing *evidence*, NOT temperatures or actual exposure |
| Gap intervals whose resumed reading was 2–6°C | **381 / 387** | A naive *latest-reading-only* threshold would not alert on the missing interval |
| Gap intervals with **both** boundary temperatures 2–6°C | **375 / 387** | Stronger counterexample: two normal endpoints do not prove anything about missing interior |

Every figure is **synthetic**. The source dictionary's `temp_excursion_exposed` is a *retrospective outcome*, not real-time traceable equipment-to-unit evidence. The data lacks historical named-fridge-to-unit mapping. Thus the 2,119 cannot become “TrustLedger will save 2,119 patients”.

## Clarify the three distinct failures

1. **Safety failure — an unreviewed cold-chain incident is overlooked:** directly addressed by evidence validation, case history, human review and synthetic issuing guard. This is the MVP's **primary outcome**.
2. **Availability failure — an investigation is unresolved:** repeated holds/investigations *could* leave otherwise usable stock in limbo. **This is a plausible hypothesis, not demonstrated by the supplied dataset**. To help, the MVP should support explicit investigation state and evidence-backed closure rather than permanent blanket restriction with no path to resolution.
3. **Supply planning failure — expiry, shortage and school-holiday volatility:** mostly **outside** this workflow. Redistribution and donor forecasting are separate modules/users/data goals. Keep as motivation/roadmap, not hackathon implementations.

**Counterintuitive but important:** A system that blocks uncertain stock without enabling *proper evidence resolution* could worsen apparent shortages and contribute to loss. A device or model cannot deem an exposed unit usable just because the latest temperature is normal, a sensor glitch seems likely, or blood is in short supply. Qualified site-specific SOP and corroborating evidence remain essential.

## Updated one-sentence positioning
**TrustLedger helps blood banks resolve cold-chain incidents safely and promptly: validate imperfect temperature evidence, expose uncertainty, trace candidate inventory only where location records exist, obtain documented human decisions, and enforce those decisions at a simulated issue desk.**

Judge hook: **“The reading is normal. The evidence is not.”** The wider why: **“When blood is scarce, we cannot afford either unreviewed exposure or unresolvable uncertainty.”**

## Revised workflow contract (not all implemented)
**Already working:** evidence classes (gap, documented glitch, observed excursion), full-dataset audit script, curated scenarios, operator proposal, simulated review Accept/Change/Reject, browser-local audit, mocked issue restriction, rule baseline and browser tests.

**Important gap to close:** incident closure with *corroborating* evidence. At present, the demo permanently blocks all abnormal/incomplete cases and only allows a deliberately clean control after simulated sign-off. That is a defensible safety default but incomplete for the *resolution* story. A future test case can use additional **explicit synthetic corroboration**, documented equipment/location timeline and a human-reviewed disposition. Never auto-clear because data were missing or a value was invalid. No clinical release should be represented as implemented.

**Source gap:** current web UI uses 4 curated cases; full ZIP cleaning pipeline is separate. Connecting the quality audit to case actions and explaining lineage is more valuable than new blood forecasting features.

**Practical next demonstration:**
1. Open facility scenario with a normal latest value and missing 57-hour interval.
2. Show it is one instance of **381 normal-resumed monitoring gaps** in the synthetic year, contrasted with a latest-only baseline.
3. Show raw vs validated sensor-glitch records (including 0°C) and name reconciliation. **Never fill missing readings as 4°C.**
4. Show candidate unit/location provenance is supplemental synthetic; mark unverified if not enough traceability.
5. Attempt mock issue, block and record; two-role documented hold/review.
6. Ideally show an actual investigation decision path that ends in either a *continued hold* or independently supported mock resolution; evidence and verified reviewer requirements explicit.
7. Explain wider availability stakes with the 23.21% aggregate RBC/WB waste and 2,119 retrospective exposed/transfused; do NOT imply they were prevented by our tool.

## Measurements that could justify advancement
- **Data detection coverage:** demonstrate the 387 gap intervals captured; 381 missed by naive latest-only threshold, but competent gap-aware rules also catch them. This is descriptive detection, NOT ML superiority.
- **Workflow integrity:** zero mock issues through the guard for unresolved evidence; record each attempted issue and reviewer action, including test for offline fallback.
- **Review completeness:** mandatory reason, source timestamps and evidence scope captured; compare the exact required fields with a competent manual ticket baseline. No fabricated user testing or faster resolution numbers.
- **Stock outcome:** *not measurable as an intervention* in this generated dataset. Do not claim units saved or reduced expiry unless a justified counterfactual is available.
- **Human reality check:** ask blood service practitioner what specific evidence qualifies for incident closure or quarantine and how to map unit to equipment. Not yet validated.

## Immediate scope decision vs other proposed concepts
- **Do:** cold-chain and data quality (as assigned), review-to-restriction outcome, stronger provenance, raw/validated status, clear source-based magnitude and short demo.
- **Do not:** donor campaign scheduling for school terms, expiration forecasting, broad inventory lifecycle, cross-region redistribution or live messaging. Those require separate integration, permissions and testing in a 24-hour build.
- **Potential extension after this demo:** standards-based case API, robust unit history, secure reviewer RBAC, auditable reconciliation, offline sync, then evidence-based inventory/forecasting integration.

## Truthfulness / clinical boundary
Synthetic does not mean **safe for clinical decisions**. The mock issue restriction is not a validated system preventing patient exposure. Any decisions about blood temperature excursions, quarantine, unit disposition and compatibility remain subject to locally authorized qualified people, local SOP and applicable law.

## Sources and cross-references
- Kickoff full transcript: user's connected Descript project `e189198b-2409-4b80-a35b-033c0e066c8a`, composition `a5dbdcf5-d705-41cc-82af-b80abfc44669`. Interpret timestamps with ASR transcription uncertainty.
- Official Technical Phase Brief PDF, 9 Nov 2026 (in Applicant's Kit).
- Original synthetic starter `README.md`, `DATA_DICTIONARY.md`, `units.csv`, `requests.csv`, `donors.csv`, `temperature_logs.csv`.
- `docs/KICKOFF_AUDIO_REQUIREMENTS_AND_DECISIONS_2026-11-10.md`
- `docs/TEAM_PRODUCT_DECISION_2026-11-10.md`
- `scripts/system_pressure.py` and `data/system_pressure_snapshot.json`
