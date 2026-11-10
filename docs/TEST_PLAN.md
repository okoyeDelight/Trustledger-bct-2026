# Acceptance and evaluation plan (design; no results yet)

## Official judging weights (out of 100)
| Criterion | Weight | Proof we must show |
|---|---:|---|
| Working end-to-end prototype | 25 | Live case → operator → reviewer → audit/issue guard, with repeatable run steps |
| Technical depth & architecture | 20 | Actual architecture, data model, validity checks, error handling, failure scenarios |
| AI / data approach | 15 | Reproducible comparison against a fair baseline, reasons, uncertainty and fallback |
| Blood-system problem and named user | 15 | Precisely worded job-to-be-done and practitioner-confirmed safety workflow, honest unknowns |
| Fit for African conditions & scale | 15 | Working basic-phone view, bad connectivity/power behavior, meaningful config rather than claims |
| Demo and readiness | 10 | <=3 minute recorded walkthrough, tested login, able to answer implementation questions |

## Test data boundaries
Use only organizer synthetic CSVs and transparently labelled additional synthetic fixtures. Do not use final `units.status` or `units.temp_excursion_exposed` as future-known production features. Keep a fixed, documented replay clock. Preserve source values.

## Required deterministic cases
1. **Observed excursion:** genuine above-source-demo-range RBC/WB readings → incident, timestamps, source, cause if observed (not guessed); authorized review.
2. **Missing readings:** e.g. a 57h facility gap → 'UNVERIFIED' and escalation, never 'normal', 'safe' or definite damage.
3. **Known implausible sensor reading:** e.g. 99.9 / -99 / 0 in provided model → flag suspicious value and preserve the original; cannot silently auto-clear incident.
4. **Outage context:** overlap source power outage with readings and distinguish correlation from proof.
5. **Incomplete transfer receipt:** missing `received_at` → traceability/documentation issue, not inferred failed delivery or unobserved temperature excursion. Optional if main path complete.
6. **Unit attribution:** distinguish a synthetic confirmed named fridge-to-unit assignment from facility-level candidate stock. No false certainty.
7. **Review separation:** operator cannot impersonate reviewer. Reviewer must record Accept / Change / Reject + reason; change history append-only.
8. **Mock issue safety gate:** a held synthetic unit cannot pass mock issue, even with explanatory AI switched off.
9. **Fallback:** stop AI/summary component and show successful manual/rules review; if claiming offline mode, test disconnected storage and reconnection.

## Comparator design
- **Simple baseline:** alarm only on valid out-of-range recorded temperatures.
- **Competent conventional baseline:** threshold + completeness and implausibility checks, with straightforward case fields.
- **Candidate method:** evidence-quality-aware case linking + authorized human review; may or may not outperform a good rules method.
- Use the same fixed scenario set and exact timestamps for each; record **TP/FP/FN**, issue coverage, evidence quality, review completion and audit completeness. Record task time only if actually measured.
- Do **not** call lower false alerts or improved staff outcomes proven without results. No arbitrary 'AI accuracy' percentage.

## Pre-submission release gate
- [ ] Check-in submitted with roster and repo by Tue 10 Nov 14:00 EAT / 12:00 WAT.
- [ ] End-to-end functionality works from a fresh clone.
- [ ] Real test output and command included; findings reproducible.
- [ ] Reviewer action, audit and simulated issue guard shown.
- [ ] AI/data explanation, uncertainty, and working fallback shown.
- [ ] Mobile/slow-connection behavior demonstrated (and no untested offline claim).
- [ ] No clinical or dataset-provenance overclaim.
- [ ] Public GitHub repo with substantive incremental commits.
- [ ] Demo video <=3 minutes; recommended recorded by Wed 10:00 EAT / 08:00 WAT.
- [ ] Architecture diagram, up to 8 slides, AI-tool disclosure and README filled honestly.
- [ ] Submission sent by Wed 11 Nov 12:00 EAT / 10:00 WAT.
