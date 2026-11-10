# Organizer kickoff: verified written instructions vs inaccessible video
**10 November 2026 · Evidence status: partial, NOT a video transcript**

## What was actually accessible
1. Hany Zuhudi's emailed **"Kickoff recap, recording and next steps: Terumo BCT Africa Hackathon 2026"** received 10 November 2026, 13:14 EAT (10:14 WAT).
2. Hany's follow-up email at 13:22 EAT giving the Google Drive recording link.
3. The official native Google Doc **"Terumo BCT Africa Hackathon 2026 - Technical Phase Brief"**, dated 9 November 2026 and modified 10 November.
4. The Google Drive Applicant's Kit folder inventory. The recording metadata is available: id `1oDvi74n6Y9TT8HwSUUWc7W5fstOPZIuT`, file type `video/mp4`, 382,576,524 bytes.

**Critical access limitation:** Google's connector can read the video *metadata* but returned HTTP 403 for direct media fetch AND raw streamed download; generic web fallback also could not access the recording. **The recording has NOT been watched, heard, or transcribed. No remarks below should be represented as direct quotes from the video.** The email states meeting notes were attached, but Gmail reports zero attachments, and no meeting-notes file is listed in the shared folder.

## Verifiable written recap (Hany, 10 Nov)
- Code build period: Tue 10 Nov 12:00 EAT to Wed 11 Nov 12:00 EAT. No pre-existing application code.
- Must submit a public GitHub repository with README, a *short working* video and pitch slides.
- AI tools allowed; document which tools were used and for what, in README.
- Synthetic starter data; additional sources only if cited; never real patient/donor records.
- Expert Q&A at 15:00 EAT (13:00 WAT): **Ted Nyaoke (blood services)** and **Richard Odongo (health data)**; same Google Meet as kickoff.
- Technical questions can go to the team's announcement/support channel; organizers won't solve code/debugging. The authoritative brief designates email/check-in for questions and announcements WhatsApp as read-only; use those channels.
- Hany wrote: team questions raised during kickoff would receive individual replies.
- Video recommended and final submissions due Wed 12:00 EAT (10:00 WAT).
- Finalists announced Wed, rehearsal Thu, hybrid showcase Fri 13 Nov. Invitation to continued engagement with Terumo is conditional, not guaranteed.

## Source conflict
Hany's email asks for **8–10 pitch slides**, while the Technical Phase Brief's formal "What to submit" says **UP TO 8 slides**. **Use eight slides** to meet both sets of instructions; do not claim this discrepancy was resolved by organizers.

## Official technical brief: non-negotiables
- One end-to-end workflow in the team's designated area: **cold chain plus data quality**.
- For cold chain, the brief specifically asks to detect fridge/cool-box temperature problems, list affected units, and stop them reaching a patient. The synthetic dataset lacks historical **named-fridge-to-unit mapping**, so our precise unit list needs an explicitly disclosed synthetic fixture or expert-confirmed proxy. Do not manufacture unit-level provenance from facility-level readings.
- Working end-to-end prototype (25 scoring points), architecture/technical depth (20), AI/data baseline with honest measured numbers (15), blood-system user fit (15), African conditions/scalability (15), video/readiness (10).
- A named person performing a real workflow; two roles and recorded Accept/Change/Reject review; human authority remains sole clinical decision-maker.
- Working AI/data feature vs a **simple baseline**, explain uncertainty, show fallback when AI wrong/offline. Compare to competent rules baseline additionally for honest rigor; do not promise superiority.
- A runnable screen/dataflow; diagram, APIs/data model/optional standards mapping; mobile and slow-connectivity fit, configurable site/country if feasible. Never claim a planned feature is already tested.
- Commit incrementally within window; one shared team repository public by final submission; code only by declared roster members.
- <=3-minute video. Complete truthful README using supplied template. Up to 8 slides per technical brief.
- Do not release blood, override laboratory restrictions, decide clinical compatibility, contact patients/donors unapproved or present guesses as fact.

## Decision gate for TrustLedger
**Keep, with higher proof priority:** the currently proposed cold-chain exception → evidence integrity check → potentially affected inventory → staff review → authorized hold / simulated issue restriction → audit.

**What must change in execution:** begin demo from a *consequential mock issue attempt* showing the impact of a 57-hour missing log; ensure precise unit links are properly sourced (supplemental synthetic fixture) and human-authorized decisions actually change a persistent guard. Show a false/implausible 99.9°C sentinel without false certainty. Prefer a complete end-to-end path over wider dashboards or cosmetic AI. Stage the data-quality measure and fixed baseline comparison early.

**Unanswered by the accessible written materials:** Hany's precise oral remarks, answers to participant questions, explicit permission to go solo, whether another team's scope was changed, any additional oral scoring emphasis, and clinical expert feedback. These must be marked UNVERIFIED and cannot justify a pivot.

## Immediate operational priority
- Ensure 14:00 EAT (12:00 WAT) team roster + GitHub check-in is submitted. Solo roster alteration requires organizer confirmation; record provisional status truthfully.
- During 15:00 EAT expert session, ask who owns fridge incident disposition, how affected units are attributed, and how staff handle monitoring gaps. Do not claim verified user research before hearing answers.
- Recheck any later organizer correction to slide limit, team roster and video requirements.
- Request accessible video, an audio-only copy, or timestamped transcript; compare against these written records and append any corrections. Until then this is **not** an exhaustive review of the recording.

## Sources
- Official brief: https://docs.google.com/document/d/1vVODvnIPy1TnPHBqHeBQ32WBEY1cgH4nQiGdGErH6Fc/edit
- Recording (metadata confirmed; media access denied): https://drive.google.com/file/d/1oDvi74n6Y9TT8HwSUUWc7W5fstOPZIuT/view
- Hany kickoff recap email (authenticated Gmail message id `1a1c4f3c25025b38`), recording link follow-up (`1a1c4fb28c2628aa`).
