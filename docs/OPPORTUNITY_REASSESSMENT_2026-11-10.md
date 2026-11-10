# Opportunity reassessment — be willing to pivot within assigned challenge

**10 Nov 2026, after user requested that stronger ideas may replace the current approach.**
**Status: decision candidates, NOT a new feature request and NOT a retrospective clinical claim.**

## Hard constraint from official Technical Phase Brief
“Stay with the challenge area listed for your team ... If your team wants to change, tell us in the kickoff call or on the check-in form before 14:00 Tuesday.” Assigned areas: **cold chain + data quality**. It is now after that time, so a full pivot into donor retention, pure forecasting or redistribution would require explicit organizer permission. It is legitimate to change **which cold-chain/data-quality workflow** we build.

## Four problem opportunities, assessed without protecting prior work

| Candidate | Magnitude and dataset evidence | Direct outcome to demonstrate | Major blocker | Decision |
|---|---|---|---|---|
| A. Fridge monitoring uncertainty | 387 facility-level monitoring gaps, 381 resume at normal 2–6°C; one 57h gap already tested | Gap detected -> reviewed -> mock issue blocked | Dataset contains no historical named-fridge/unit association; present unit links invented | Valuable and tested; needs stronger source-backed unit story |
| B. Missing transfer receipt / provenance | **35,181 transfers, 1,046 missing `received_at`, 1,046 unique linked unit IDs, 873 later labelled `transfused`**. 882 routine, 111 emergency_request, 49 emergency_cross_region, 4 inter_centre_rebalancing | Show exact `transfer_id` + `unit_id`, provenance uncertainty -> authorized receiving verification -> issue control | Missing receipt does NOT prove unit never arrived, cold-chain failure, unsafe transfusion or illegality. Local SOP not verified; zero observed trip temps above dictionary >10°C threshold. Need design a way to *resolve* missing receipt, not permanently hold all units. | **Serious challenger**: better direct unit traceability and data-quality; evaluate as core or supporting demonstration |
| C. Wastage / expiry / redistribution | Synthetic 4,901 expired and 3,719 temperature-discarded RBC/WB among 37,147; hospital requests unfilled/partial 2,241/17,430 | Transfer near-expiring units to demand sites, show avoided waste in held-out or simulated outcome | New challenge area, counterfactual hard, multi-site inventory and clinical restrictions, 24h. Existing retrospective outcomes can't prove preventability | Do NOT pivot without approval or a strong validated baseline |
| D. Student donor cycles | 25,182 of 43,363 donor records labelled students; organizer discussed school closures | Plan donor drives by school terms | Requires school-calendar/drive response counterfactual, different user and challenge, student share alone not causal proof | Context on scarcity, not part of immediate build |

## Transfer data directly inspected in original ZIP, not inferred from a design

- Columns in `transfers.csv`: `transfer_id, unit_id, from_facility_id, to_facility_id, transfer_type, request_id, dispatched_at, received_at, transport_mode, coolbox_max_temp_c`.
- Source dictionary says `coolbox_max_temp_c > 10°C` is a trip excursion.
- Among **35,181** transfers, **zero** recorded maximum values above **10.0°C**; highest observed = **10.0°C**. Therefore do not invent transportation temperature excursions or claim “at-risk trip based on 10°C threshold”.
- **1,046** transfers have blank `received_at`; they link to **1,046 distinct unit IDs**. The **retrospective** `units.csv` statuses for those units: **873 transfused, 104 expired, 42 discarded_temperature, 27 in_stock**. This is a **documentation / provenance finding**, NOT proof of missing physical receipt, harm, absence of required checks or wrong clinical release. Some later status records may have been recorded after a legitimate but undocumented delivery.
- Example directly from source: `TRF-005463`, unit `U2511-NKR-006818-RBC`, RBTC-NKR -> HSP-024, dispatched 2025-11-03 09:42:45, blank receipt, recorded max 4.9°C, later unit status “transfused” 2025-11-04. **This can be shown as a retrospective *documentation anomaly* and used as a synthetic prospective workflow fixture. Never imply the historic unit was unsafely transfused.**
- Another: `TRF-005675`, `U2511-ELD-007087-WB`, no recorded receipt, recorded max 5.2°C, later expired. Not evidence the expiry was caused by an incomplete receipt.

## Strongest current hypothesis
**TrustLedger = an evidence-to-authorized-handoff / cold-chain assurance layer, not a standalone fridge dashboard.** A specific unit cannot be treated as fully verified in the mock workflow where key provenance is missing; authorized staff may reconcile source records, document exceptions, then decide under actual SOP.

Two candidate triggers may fit *one common review-to-guard workflow*: (1) monitoring evidence gap/outlier, (2) a missing transfer receipt linked to an exact unit. We should avoid calling these two complete new products, but need a *single tight demo* and one comprehensible judge hook.

Potential strong story:
- “The latest temperature looked safe, but 57 readings were missing.”
- “A unit was later marked as transfused, but no receipt record existed for its transfer.”
- “The common issue is not just bad temperatures. It is **unverified evidence being treated like verified evidence**.”
- “Human review, source provenance and mock issue restrictions prevent the process from silently continuing.”
**No claim of actual patient benefit until tested.**

## Decision criteria — explicit kill gates
1. **Scope:** remains within assigned cold chain + data quality, or team obtains official permission for an alternative.
2. **Importance:** can articulate a specific clinical operations user, real question, and consequence without inventing actual harm.
3. **Evidence:** genuine source-linked records, not mainly invented fridge/unit associations or leaked future labels.
4. **Action:** meaningful human decision that demonstrably changes a mocked issue/handoff workflow; not a “data errors dashboard”.
5. **Baseline:** a competent conventional process provides fair benchmark; no fake ML claims or unsupported time saved.
6. **Delivery:** one end-to-end reproducible working workflow, functioning phone browser, public repo, video <=3m, eight slides by Wed 12:00 EAT.
7. **Evidence-backed correction:** candidate B needs SME/SOP validation; do not automatically infer a missing transfer receipt requires quarantine or clinical hold.

## Recommended next engineering experiment, before full pivot
Build/validate *one* **retrospective transfer exception view** using exact `TRF-005463` and linked unit records, with explicit provenance fields and “unknown receipt” vs “arrived/not arrived” distinction. Show a *mock documentation hold* until responsible staff attest/reconcile record—not a clinically authorized hold. Test against the existing 57-hour monitoring gap, compare which gives judges a clearer input/action/outcome, and **pick one primary hero**. No forecasting, SMS or extra platform modules.

## Relationship to earlier locked scope document
Earlier `docs/TEAM_PRODUCT_DECISION_2026-11-10.md` and `docs/IMPACT_THESIS_AND_PRODUCT_DIRECTION_2026-11-10.md` advocated one specific path. **Those are hypotheses, not binding instructions**. Prefer measured evidence and the latest verified organizer requirements; change direction if another path beats them.

## Source verification
The user-uploaded `Hackathon Starter Dataset (1).zip` was inspected locally by reading source `transfers.csv`, `units.csv` and `DATA_DICTIONARY.md` directly; exact counts above obtained by file joins, not by inference from unit-status summary. No real patient or donor data. Named fridge-to-unit history remains missing in that starter data. User allowed discarding weaker approaches in favor of stronger relevance.
