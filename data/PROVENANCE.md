# Data provenance for the runnable TrustLedger prototype

**Starter source:** Terumo BCT Africa Hackathon 2026, \`Hackathon Starter Dataset.zip\`, \`temperature_logs.csv\` (synthetic, Kenya-inspired, timestamps in EAT, UTC+3). This is not real Kenyan hospital monitoring or real blood inventory.

The UI directly embeds four selected excerpts from the supplied starter synthetic CSV in \`src/engine.js\`. They are reproduced, not dynamically loaded or fabricated:
- \`HSP-024\`, Sep 30 2026 at 07:00 3.9°C, 08:00 4.3°C, 09:00 3.9°C; next available Oct 2 at 19:00 4.3°C, 20:00 4.2°C, 21:00 4.2°C. Difference between 09:00 and 19:00 is **58 hours**, with **57 absent hourly records**.
- \`RBTC-NBO\`, Oct 5 23:00 5.9°C through Oct 6 03:00 5.4°C, including 00:00 7.0°C, 01:00 7.9°C, 02:00 6.2°C.
- \`RBTC-NBO\`, Mar 27 06:00 3.9°C, 07:00 3.8°C, 08:00 **99.9°C**, 09:00 3.9°C, 10:00 3.7°C, 11:00 3.9°C.
- A four-reading **negative control** drawn from HSP-024 Oct 2 19:00–22:00. This is deliberately a limited clean window, not a claim of overall unit safety.

## What we invented for the workflow demo, and why
The organizer's \`temperature_logs.csv\` uses **facility_id, recorded_at, temp_c**: there is NO historical named-fridge/device ID and NO equipment-to-unit assignment timeline. The \`units.csv\` status and temp exposure fields include retrospective outcomes, not point-in-time location certainty.

To make the **simulated** issue guard testable, we created \`DEMO-RBC-*\` unit IDs and \`FR-A/B/C/D\` example fridge assignments. These are explicitly **supplemental synthetic fixture records**. They DO NOT come from the starter dataset and do not establish actual unit exposure. We do not use the later \`units.csv\` outcomes as if they were known at review time.

## Scope of comparison
Only **four hand-picked, manually annotated demo windows** with three positive review cases and one negative review case. “Latest reading” baseline flags only the latest value outside the *illustrative* 2–6°C band; the competent rules baseline detects missing intervals and obvious outliers too. Our evidence feature matches the competent rules baseline on this selection; we do not assert new machine-learning superiority, unbiased diagnostic performance, or actual patient benefit.

## Policy and safety
2–6°C is an **illustrative RBC demo band**, not a verified local SOP; the sanity band −10 to 25°C is an engineering example. Do NOT generalize to platelets, plasma, cryoprecipitate, or other components. No actual human authorization is implemented: both roles are browser simulations. Decisions are stored in localStorage, not a regulated immutable audit log. “Issue allowed” means only that a synthetic unit on a *clean control window* has been approved in the local mock exercise; there is no blood group compatibility calculation or release for transfusion.

To reproduce, locate these \`facility_id + recorded_at\` rows in the original zipped \`temperature_logs.csv\`.
