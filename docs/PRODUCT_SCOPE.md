# TrustLedger product scope — provisional decision (10 Nov 2026)

## 1. The one job we are building
**A blood-bank duty operator encounters abnormal or unverified temperature evidence and needs to finish a traceable, documented incident review with an authorized quality reviewer, without an unreviewed unit proceeding through a MOCK issue path.**

This is ONE workflow, not inventory forecasting, donor recruitment, emergency dispatch, broad analytics, general donor deduplication, or an entire ABBIS.

## 2. Named users and unresolved reality check
- **Operator:** inspects evidence, adds human observations, proposes a status/action, requests review.
- **Authorized reviewer (quality officer or locally designated responsible person):** evaluates source evidence, changes/accepts/rejects the proposed action and records reason, identity and time.
- The exact user role and facility SOP need blood-service practitioner confirmation; the brief and WHO guidance do not prove our hypothesized user pain point exists at a specific site.

## 3. Observable walkthrough (scope lock)
1. Open a demo incident from the synthetic monitoring dataset.
2. Separate: **(a) valid observed excursion**, **(b) missing/unverified interval**, **(c) implausible sensor value**. Preserve raw reading, source, timestamp and justification.
3. Combine relevant power-outage context; distinguish observation, inference and lack of evidence.
4. Show units potentially impacted by place/time. Existing CSVs have no historical named refrigerator location; **only** explicitly added, transparently synthetic location-time fixtures may support a precise unit list. Otherwise show 'potentially affected / cannot determine' and do not invent certainty.
5. Operator records a proposed hold/review action or requests more evidence. No automatic clinical release/discard.
6. Authorized reviewer Accepts / Changes / Rejects with reason, timestamp and a durable audit record. A simulated held unit is refused by the **mock** issuing screen until appropriately handled.
7. Re-run the same task when AI/explanatory service is disabled; basic rules and manual note/decision pathway must still work.

## 4. First build slice / strict cut line
**Must work for judges:** Import selected synthetic CSVs; choose one case; detail screen and evidence trace; editable proposal; separate reviewer role; recorded decision/audit; simulated issue guard; one deterministic data-quality method and baseline numbers; documented fallback; functioning phone-sized web view.

**Only after the end-to-end path works:** more cases; configurable sites; demonstrated offline persistence/reconciliation; improved report export; optional grounded LLM summary. No feature may be labelled 'working' before tested.

**Out of scope:** blood-group compatibility algorithm, independent medical clearance, clinical discharge, physical refrigerator control, live equipment integration, real donor/patient data, national deployment, formal ISBT 128/FHIR compliance, real SMS campaigns.

## 5. Evidence and policy
- **Hackathon source:** official 9 Nov Technical Phase Brief; ONE workflow; AI/data feature vs baseline; Accept/Change/Reject; fallback; architecture; <=3 minute video; public repository at deadline.
- **Quality source:** WHO 2025 Good Practices for Blood Establishments, esp. sections on deviations, storage monitoring, computerized data integrity, storage/distribution, and authorization.
- **Data source:** organizer synthetic starter CSVs and dictionary. EAT timestamps. `temp_excursion_exposed` and final status are retrospective, unavailable as prospective evidence.
- **Difference between review and clinical release:** our prototype is an educational simulation only. Qualified site staff and applicable SOP must authorize actual component decisions.

## 6. Unanswered gating questions
1. When a logger fails, who first notices and who reviews it?
2. What actual evidence and signed authorization are required to hold, release or dispose of potentially affected blood?
3. How does a site establish which named units were in the named fridge during the period?
4. Is this decision currently hard/slow enough for a dedicated tool to be beneficial?
5. Which current staff tool already does this, and why is it insufficient?

## 7. Stop or pivot if
- We cannot represent unit-level effects without misrepresenting dataset provenance.
- We cannot deliver a true end-to-end authorized review + blocking demo in the window.
- Expert feedback contradicts our assumed workflow; no evidence of staff value emerges.
- The method adds no value over competent rules and the review-task improvement is not measurable.

## 8. Team arrangement
Use a shared repository and incremental commits. Assign one engineering owner to the working path and a second reviewer for data/clinical assumptions, regression testing and video. Do not allow concurrent assistants to overwrite the same branch/file without a review protocol.
