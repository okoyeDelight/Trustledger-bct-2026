# Eight-slide pitch deck — factual outline for team and Claude

**Output status:** Slide-by-slide content plan, NOT yet a rendered slideshow/video. Written Technical Phase Brief permits up to **eight** slides; keep exactly eight.

| Slide | Heading | What the judge should see | Proof and caveat |
|---|---|---|---|
| 1 | **The reading is normal. The evidence is not.** | TrustLedger brand, 4.2°C vs 57 missing hours, one-sentence product | Actual original HSP-024 synthetic feed |
| 2 | **Two expensive outcomes of uncertainty** | Safety risk of an unreviewed event vs resource scarcity and delayed case closure; Hany's synthetic blood-system pressure | 8,620 of 37,147 RBC/WB synthetic units recorded wasted (4,901 expired, 3,719 temperature discard); this is NOT estimated preventable units or TrustLedger impact |
| 3 | **One blood-bank user, one critical job** | Duty operator → quality reviewer → mock issue desk; explicit intended user | SOP, actual unit-location data and clinical authority remain to be confirmed with practitioner |
| 4 | **Working TrustLedger, not a slide prototype** | Actual screenshots: missing readings, source outage, labelled candidate custody, blocking and review | Show real tested screen. Unit associations are supplemental synthetic fixtures; no clinical release |
| 5 | **Clean the deliberately messy data** | Raw → flagged → validated/reviewed. 55 documented sensor sentinel rows, 387 monitoring gap intervals, 1,852 exact name mismatches | Source `scripts/audit_starter.py`; don't call all name differences “errors” or auto-merge donor candidates |
| 6 | **Evidence and evaluation** | Full-year 381/387 gaps resume in-range; four-case baseline (latest-only 1/4, competent rules 4/4, feature 4/4); honest error accounting | No superiority to competent rules or independent clinical validation. Real benefit is proposed workflow and review gate |
| 7 | **Architecture and African realities** | Synthetic CSV → source-preserving audit → generated JS evidence + outage join → browser rules → human review → mock guard → local audit; offline shell cache | Browser-local and same-device only; no production RBAC, backend, multi-device sync or hospital API |
| 8 | **Working proof / what comes next** | GitHub CI passed, real browser checks across mobile/desktop; judge-accessible demo URL and repository; responsible deployment gates | Hosting/public repo link required; future device-unit linkage, qualified site validation, secure audit and prospective testing |

## Design rules
Use a disciplined healthcare-operations visual system (dark ink, clear teal, restrained amber). One message per slide; readable from an ordinary phone. Use actual app captures with source labels. No invented prevention percentage, trained-ML claim, certified compliance, clinical release or real-world harm statistics. Clearly label synthetic dataset and added fixtures.

## Delivery checklist
- [ ] Public HTTPS demo confirmed in incognito/unauthenticated mobile browser
- [ ] Public source repository or organizer-approved accessible code/repo
- [ ] Architecture diagram with real implemented code boundaries
- [ ] Real-screen <=3-minute video with audible narration
- [ ] Eight-slide deck exported per organizer instructions
- [ ] Working README, AI-tool disclosures and baseline tables
- [ ] Team roster / contributor agreement verified with organizer
