# Kickoff AUDIO transcript: organizer requirement audit and TrustLedger decisions

**Meeting:** Terumo BCT Africa Hackathon 2026 kickoff, 10 Nov 2026, 35m36s.  
**Evidence:** User-uploaded MP4 directly transcribed via Descript project `e189198b-2409-4b80-a35b-033c0e066c8a`, composition `a5dbdcf5-d705-41cc-82af-b80abfc44669`.  
**Open project:** https://web.descript.com/e189198b-2409-4b80-a35b-033c0e066c8a/a5dbd  
**Important:** This is a machine-generated transcript and may misrecognize proper names/technical terms (e.g., company names); quotations below are brief and timestamped. Treat original audio as ultimate authority. Speaker 2 appears to be the lead organizer Hany, based on role and context, but Descript labels speakers numerically.

## Executive decision
**No product-area pivot. Stop treating UI polish as the winning argument; prioritize a functioning, demonstrable blood-bank operator/reviewer workflow, an immediately legible short video, a reproducible data analysis, and proof of user/problem fit.** The matching of a proposed 57-hour data gap to a real named refrigerator is *not* present in the organizer dataset; keep supplemental synthetic mapping clearly marked.

## Timestamped organizer statements and their consequences

| Recording time | Transcript-grounded instruction or observation | TrustLedger impact |
|---|---|---|
| 00:00–00:45 | A company technical-services/field-operations representative from Nairobi says they will be a judge/reviewer. Descript transcribes the company name inconsistently. | Design should withstand technical/systems questions, not solely look appealing. No guess about their decision criteria. |
| 09:30–10:55 | Lead organizer congratulates teams, says the 24-hour clock has started, asks participants to use the WhatsApp/email channels for missing resources or clarification. | Continue committing within build window, document blockers, use official channels. |
| 11:55–14:12 | Blood collection, testing, storage, movement; one real problem for **one real ecosystem user** such as blood-bank manager, lab technician, hospital, donor. Narrow scope to suit 24h. | Our intended operator and quality reviewer qualify as plausible concrete users; **actual frontline need remains unvalidated**, so describe as hypothesis until a practitioner confirms. |
| 14:38–15:30 | Challenge domains explicitly include **cold chain** and **data quality**, among others. | Remain in assigned domain. Do not pivot into whole supply chain, donor retention or emergency dispatch. |
| 15:36–16:15 | **“The judges are looking for potential, not polished ... submissions.”** Show working solution that can grow, not only styling. Possible opportunity to continue with Terumo BCT beyond prize, not contractual guarantee. | The current tested workflow beats a cinematic landing page for scoring. Mention future scale only as conditional possibility. |
| 16:59–18:29 | Shared Applicant's Kit and links; roster/repo check-in by 14:00 EAT, another check-in 20:00 EAT, next day check-in, final form at noon EAT. | Check-in forms/timezone WAT = EAT minus two hours. |
| 18:45–19:15 | A **demo video** is required and is **“the first thing that the judges will look at”**, before GitHub. | Record concise genuine end-to-end walkthrough; prioritize video over marginal animations. This differs from the written brief's README-first framing: both must be excellent; avoid overclaiming a definitive order across sources. |
| 19:16–20:00 | Organizer slide template is optional; participants may use own design, **“eight to 10 slides”** suggested orally. | The official PDF says **up to eight**, so produce **eight** to satisfy both. |
| 20:10–21:20 | One year of data, 47 synthetic facilities, from Nov 2025 through Oct 2026; all synthetic, no real people/hospitals. Extra datasets permitted if cited; do not share patient/donor confidential data. | Clearly disclose added DEMO units, avoid real-world national rates. |
| 21:42–22:35 | Organizer gives synthetic-study example figures: **“about 23 percent”** RBC/whole-blood units wasted, and **2,119** units going to patients after unflagged out-of-range fridge readings; emergency resupply around five hours; student school-holiday donation effects. | **2,119** could motivate our issue-guard demo, but must independently verify interpretation from raw dataset before claiming reproducibility. No actual patient harm claim. Broader numbers are context, not directions to implement those workflows. |
| 22:38–23:12 | Dataset mess is intentional: duplicate donors, missing blood group, misspelled facility name, sensor glitches. CSV, SQLite and dictionary supplied; cleanup counts toward work. | Preserve real raw anomalies, flag rather than quietly repair; show data quality provenance. |
| 23:25–25:05 | All submitted code must be built in 24h; open-source libraries allowed; no old project code; explicitly name ChatGPT/Claude or other AI use in README. | Current repo commits are during build window. Do not import old repos' app code. |
| 25:14–25:50 | Same meeting link used for 15:00 EAT expert/Q&A; Richard Odongo (ASR approximates surname) and Ted available with organizer. | Seek actual SOP/monitoring gap attribution from experts; don't invent answers. |
| 26:20–28:30 | Five finalist **teams**; Friday live hybrid showcase, virtual option for teams outside Nairobi, Thursday rehearsal. | Remote participation is possible; no need to assume travel required. |
| 29:30–32:50 | A participant from assigned TrustLedger team asked about email response time and competing solo. Organizer explained they matched teams intentionally for workload and Friday presenter redundancy; **solo was NOT approved** on the call. Organizer promised personal email followup within ~30m. | Do not silently alter approved team roster. Verify organizer response; no such reply found in Gmail as of latest check. |
| 33:00–34:55 | User explicitly asked whether solo is possible because the requester is a member of TrustLedger; organizer reiterates team matchmaking rationale and promises a team decision in 30 minutes for uncomfortable members. Transcript then records the user responding that they were okay with the team arrangement. | **Important:** the oral response and later written solo request differ. Official written approval is necessary to resolve actual current roster; avoid guessing. |
| 35:05–35:30 | Meeting closes; organizer promises emailed recording. | Recording received and transcribed. |

## Important reconciliation of contradictory written/oral information
- **Demo-video vs README reading order:** oral meeting says video first; formal technical brief says judges read README before video. This is a genuine discrepancy between source documents. Operationally make both immediately clear; video and README should mirror the exact same measured result.
- **Slide count:** oral eight–ten vs formal up to eight. Make **eight**.
- **Solo/team:** verbal meeting promises a decision; participant at end said comfortable with team, but later emailed requesting solo. Neither establishes solo approval. Hany's reply, not our assumptions, governs.
- **Data 2,119:** organizer's oral number may correspond to a retrospective synthetic outcome field. It is NOT necessarily a defensible prospective rule model and cannot be used as such without validating the construction. Do not call these real patient events.
- **Company/guest names:** speech recognition garbles several proper names; rely on original written names where available and mark uncertainty.

## Adversarial review of our existing demo
**What holds up:**
- One complete example: facility temperature evidence -> gap/excursion/glitch flags -> human proposal -> second reviewer Accept/Change/Reject -> local auditable record -> mock issue blocked.
- Working Playwright checks and screenshots, synthetic provenance caveats, no unapproved clinical decision-making.
- The 57 missing expected hourly records demonstrates why a normal latest value is not proof.

**What is NOT yet sufficiently evidenced:**
1. A *real* blood-bank operator describing this exact bottleneck or standard procedure. Claim user fit as a hypothesis unless validated.
2. A valid named-fridge-to-unit link in provided dataset; our unit fixture is illustrative, not verified.
3. Strong comparative feature gain: currently only 4 hand-selected cases; competent rules and our feature are tied; our additional value lies in **review workflow and auditability** (not yet experimentally compared), NOT in a fabricated AI accuracy advantage.
4. A public, judge-accessible live demo link. GitHub repo is still private as of latest verification.
5. A recorded <=3-minute demo and final slide deck.
6. Organizer-confirmed team roster/solo status.

## Immediate ordered next actions (deadline Wed 11 Nov 12 EAT = 10 WAT)
1. Deploy existing tested UI to an HTTPS URL. Make repo public before final submission (only if appropriate for official hackathon, with no secrets/real records).
2. Verify key test outcomes on deployed URL using a basic Android browser, preferably a person unaffiliated with the build.
3. Produce a <=3-minute screen-recorded demo that opens with 57-hour uncertainty, takes a genuine mock issue attempt, shows operator and quality reviewer and blocked mock issue, and explains why this is an honest synthetic demonstration.
4. Reproduce meaningful benchmark from bigger starter-data subset or explicitly label tiny-case comparison and no advantage over competent rules. Never fabricate metrics.
5. Create **eight** slides, readable and evidence-rich; keep video, slides, README identical in claims.
6. Check organizer's email for roster and requirements updates; ask specific clarifications through official channel.
7. Update the handoff after each verified step; don't add an unneeded motion studio toolchain.

## Source
This is a source-first working audit from Descript's transcription of the ACTUAL uploaded kickoff recording. Use the timestamps to verify any contested phrase in the video. Preserve the complete video/transcript in user's private Descript project; **do not commit the full recording or other participants' private conversations** to the repository.
