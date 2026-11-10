# TrustLedger — Privacy-by-design scope and deployment gates

**Date:** 10 November 2026 (Terumo BCT Africa Hackathon technical phase).  
**Status:** **Synthetic hackathon prototype; NOT a KDPA compliance certificate, DPIA, registered controller/processor, clinical system, legal opinion or security certification.** Project is currently a static, browser-first demonstration with simulated roles. No real donor or patient data should be uploaded.

## Principle: build only what this prototype needs

The primary workflow remains **synthetic facility temperature reading -> validate data quality (preserve raw) -> flag missing/implausible/excursion evidence -> operator proposes action -> simulated quality reviewer accepts/changes/rejects -> mock unit issue guard and local audit**.

The Kenya Data Protection Act, 2019 (KDPA) checklist is useful to show responsible expansion, but user rights, patient consent, clinician identity assurance, data processor agreements and ODPC registration need a real operational deployment context. **Do not add a patient portal or collect real personal data for judges.**

## Current processing and access inventory

| Data | Why needed | Where now | Who can access | Data classification / concern |
|---|---|---|---|---|
| Organizers' synthetic `temperature_logs.csv` | Detect observed extremes, sensor glitches and monitoring gaps | Original ZIP held separately by builder; curated examples embedded as code in `src/engine.js` | Anyone with source after repo made public; app visitor sees demo records | **Synthetic facility-level**. No physical named-fridge telemetry |
| Synthetic `facilities.csv`, `requests.csv`, `donors.csv` read by cleanup script | Demonstrate justified source-preserving data cleaning | Uploaded starter ZIP remains outside Git; derived files locally under `derived/` | Build contributors running script; only aggregate snapshot in repo | **Synthetic** donors/patient-group fields. Keep raw synthetic data out of deployed app unless essential |
| Small aggregate `data/quality_audit_snapshot.json` | Reproduce numbers in Evidence Lab | GitHub repo and public demo UI | Public after publication | Synthetic aggregate only; not actual Kenya health outcomes |
| `DEMO-*` unit IDs and `FR-*` associations | Demonstrate what an issue restriction might look like | Hard-coded illustrative fixture in repo | Public after publication | Added **fictional** unit-to-equipment mapping; NOT proof of exposure |
| Simulated operator proposal / reviewer rationale and role labels | Show action and decision explanations | Browser `localStorage` on the visitor's device | Anyone sharing that same browser profile/device | **Not authenticated**; avoid entering real personal names, patient details or free-text confidential data |
| Simulated mock-issue attempts / event timestamps | Show traceable consequence of reviewed decisions | Browser `localStorage` | Same browser profile/device | Local audit is editable and non-immutable, NOT a regulated production log |
| Web-app delivery metadata (IP, user agent, access logs) | Serve site to judges | Hosting provider, **not yet selected** | Hosting operator under its own practices | Actual visitor/network metadata may be personal; confirm hosting terms and privacy notice before deployment |
| Third-party font requests | Render current custom fonts | CSS currently imports Google Fonts; may involve browser request metadata | Font CDN provider, depending on browser caching | Avoid unnecessary third-party browser requests if privacy/offline priority: prefer platform font stack or explicitly controlled licensed self-hosting |

### Data not collected by this demo
Real donor/patient names, phone numbers, blood group compatibility facts, medical records, consent histories, real hospital credentials, physical fridge identifiers, location history and clinical authorization. Do NOT suggest collecting any of these for the hackathon.

## Technical and governance safeguards: candid state

**Working now (verified in tests):**
- Synthetic temperature raw values are preserved; the **0°C, -99.0°C and 99.9°C** documented starter-data glitches are flagged instead of silently being treated as verified excursions.
- Synthetic missing monitoring periods remain unknown, not imputed as safe.
- A separate operator proposal and simulated reviewer Accept/Change/Reject state is required; abnormal evidence cannot be mock-cleared.
- Synthetic mock-issue attempt, outcome and decision rationale are written to browser-local event history.
- Frontend processing and safety rules do not require a network AI model or patient data API.
- GitHub CI tests and browser click-through checks provide reproducible evidence of code behavior, **not** clinical or information-security assurance.

**NOT implemented; cannot claim in submission:** real role-based authentication/authorization, clinical-site access restrictions, encryption of protected data, centralized tamper-evident audit, controlled document retention, deletion/right-of-access portals, production backup/restore, regulator notifications, monitoring, multi-device offline synchronization, validated algorithm/medical device qualification, external lab/hospital integrations, or DPIA approval.

## Kenya Data Protection Act and ODPC future deployment gates

Only when a real Kenyan hospital/provider or actual Kenyan residents' personal data enters scope:
1. **Data inventory, purpose limitation and legal basis.** Identify controller vs processor, actual categories/recipients/retention; select a valid KDPA section 30 lawful basis *per purpose*. Consent is not universally mandatory or the correct basis for all clinical operations. Confirm special-category grounds and **section 46** professional-responsibility/confidentiality conditions for personal health data.
2. **High-risk DPIA (section 31).** Before starting likely high-risk personal-data processing, assess necessity, proportionality, rights risks, data movement, automated decision effects, security controls and mitigations. Do not claim the synthetic demo itself already has a completed DPIA.
3. **ODPC registration assessment.** ODPC says health administration/provision of patient care is a non-exempt category when processing personal data, regardless of revenue/employee small-entity exception. Determine actual controller/processor entities, legal reach and register if required **before operating**; a private student experiment using fictional data should not be falsely described as a registered health provider.
4. **Real security.** Enforce authenticated operator/reviewer permissions server-side; encrypt production health data at rest and in transit; signed/append-only audit with timestamps and immutable lineage; access review, backup and retention controls; prevent unauthorised release by integration contract and clinical SOP.
5. **Processor arrangements.** Section 42 requires a written controller/processor arrangement where relevant. Contract with the *actual* hosting/SMS/analytics vendors only if selected; Oracle and SMS are NOT currently part of the app. Review all subcontractors.
6. **Privacy notice and rights.** Layered notice, lawful basis disclosure, rights workflow, retention period and contact channel appropriate to the actual controller. Consent logging only for activities validly based on consent; do not add pointless blanket medical consent toggles.
7. **Breach plan, legal timing.** Section 43: where unauthorized access/acquisition of personal data creates a real risk of harm, controller reports to ODPC without delay and within **72 hours** of awareness; processor notifies its controller without delay, where reasonably practicable within **48 hours**. This corrects the supplied checklist's **36/72** figure. Additional steps and notification to data subjects depend on applicable conditions; seek qualified local legal guidance.
8. **Cross-border transfer assessment (sections 48–50).** Identify storage and support-access countries; establish a lawful safeguard/ground before exporting actual Kenyan personal data. A hosting location being outside Kenya is not itself proof that current demo transfers patient information.
9. **AI and human accountability.** No deployed predictive model or autonomous clinical release exists. If added later, review training-data provenance, bias, error rates by component/site, explanation availability and qualified human override against documented SOP.

## Focused hackathon presentation (one slide/sidebar, not an entire new product)
- **Privacy by design:** Synthetic-only; no real patient or donor records required; raw source is retained and uncertainties are exposed; no autonomous clinical clearance.
- **Trust model:** Two human roles are simulated for demonstration, but true role-based access and tamper-evident audit are *requirements before deployment*, not hackathon features falsely claimed to work.
- **Future integration:** Secure facility access + DPIA + legal bases + agreements + ODPC registration assessment + geographic hosting review, led by an actual Kenyan health provider/controller.
- **Biggest current priority:** make prototype available via a public HTTPS demo, document evidence and prepare <=3 minute video and eight-slide pitch before Wed 11 Nov 2026 12:00 EAT (10:00 WAT).

## Authoritative references (not substitutes for Kenyan counsel)
- Kenya Law consolidated Data Protection Act, Cap 411C (sections 30–31, 41–43, 46, 48–50): https://new.kenyalaw.org/akn/ke/act/2019/24/eng%402022-12-31/source
- ODPC FAQ on registration/exemptions: https://www.odpc.go.ke/faqs/
- ODPC guidance note on health data: https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Processing-of-Health-Data.pdf
- ODPC DPIA guidance: https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Data-Protection-Impact-Assessment-1.pdf

**Interpretation note:** Kenyan applicability depends on actual activity, personal-data presence and who is controller/processor. The current hackathon synthetic data does not itself establish those conditions. No professional legal assessment performed.
