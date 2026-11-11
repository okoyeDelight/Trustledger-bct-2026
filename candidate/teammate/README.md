# [Team name]: TrustLedger cold-chain incident investigation support

Terumo BCT Africa Hackathon 2026 · Challenge area: Cold chain and data quality

## The problem

A blood-bank cold-chain officer needs to notice when stored blood may have experienced an unsafe temperature, work out which units might have been at the affected facility, and bring the evidence to an authorized reviewer. In practice, clues can be spread across temperature logs, stock and transfer records, and power-outage reports. Missing readings, sensor glitches, and unconfirmed transfer receipts make the investigation harder.

TrustLedger demonstrates how those records can be brought together into an investigation workflow. Its supplied data describes 47 facilities over 1 November 2025 to 31 October 2026. In that synthetic dataset, we counted 399,280 hourly temperature rows, 55 known sentinel glitches, 12,440 estimated missing hourly readings, 4,607 readings above 6°C, and 1,933 out-of-range episodes. These are dataset counts, not claims about real facilities.

The intended users are a facility cold-chain officer and a blood-service supervisor. These are prototype personas, not yet validated local job roles or approved operating procedures.

## What we built

- **What works now:** A responsive dashboard with Overview, Incidents, incident detail, Transport alerts, Inventory, Data quality, Review centre, and Audit log pages. The API serves results produced by the data pipeline. Demo accounts sign in through the API. A reviewer can Accept, Change, or Reject an **investigation flag**, provide a reason, and append a review event to the prototype audit log.
- **What is mocked or not finished:** The records are synthetic, not live facility data. There is no live sensor feed or connection to a blood inventory, laboratory, quarantine, patient-care, or national reporting system. The app cannot make a release, quarantine, discard, compatibility, or transfusion decision. Its two demo roles currently have the same review permissions. Review events use local SQLite and are not backed by a durable shared production audit service. The workflow, roles, and threshold need blood-service expert validation.

Demo video (3 minutes or less): **To be added by the team; no video is included yet.**

Live demo: [TrustLedger dashboard](https://trustledgersys.vercel.app/dashboard) · Test log-in: **Demo credentials will be provided privately to judges; do not publish passwords in this repository.**

## How to run it

The repository includes the six synthetic CSV inputs used by the current pipeline under `backend/data/raw/`. Allow about 10 minutes if Python and Node.js are already installed.

Requirements: Python 3.10 or later, Node.js 22 or later, and npm.

1. Create a Python environment and install the backend packages:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. Set up local demo credentials. Copy `.env.example` to `.env`, then edit it and set a random `TRUSTLEDGER_AUTH_SECRET` of at least 32 characters, both demo usernames and display names, and unique passwords of at least 12 characters. Do not commit `.env` or use example credentials in a deployment.

   ```bash
   cp .env.example .env
   ```

   In the same terminal, load the settings and build the processed dataset:

   ```bash
   set -a
   . ./.env
   set +a
   cd backend
   ../.venv/bin/python -m app.run_pipeline --data data/raw --output data/processed
   ../.venv/bin/uvicorn app.main:app --reload --port 8000
   ```

   Keep this terminal running. The pipeline should print `TrustLedger pipeline complete`.

3. In a second terminal, set up and start the frontend:

   ```bash
   cp frontend/.env.example frontend/.env.local
   npm --prefix frontend install
   npm --prefix frontend run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and sign in with one of the demo accounts you configured. The API health check is [http://localhost:8000/health](http://localhost:8000/health); interactive API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

For code checks, run `.venv/bin/pytest -q backend/tests` and `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend run build`.

## Architecture

[Open the two-layer architecture diagrams](.github/modernize/assessment/engines/facts/architecture-diagram.md) or the [architecture and data-flow notes](docs/architecture.md).

The implemented flow is: synthetic CSV files → Python validation and matching pipeline → processed CSV/JSON files → authenticated FastAPI endpoints → Next.js dashboard. Human review events are appended to a local SQLite database. The browser can cache previously loaded information and queue review submissions until connectivity returns.

In a wider blood system, facility sensors, blood inventory, laboratory, transport, and power systems could provide authorized data to this workflow. **Those integrations are not implemented.** TrustLedger currently does not write decisions back to those systems. The project discusses possible mappings to HL7 FHIR and ISBT 128, but has no standards-compliant adapter. DHIS2 is not used or integrated.

## AI and data

- **What the AI or data feature does:** The current feature is a transparent data rule, not a trained AI model. The pipeline repairs a known malformed timestamp pattern, checks missing or duplicate values and sensor sentinels, groups consecutive out-of-range temperature readings into episodes, reconstructs confirmed unit-location intervals from transfer records, and finds RBC/whole-blood units whose known location overlaps sustained incidents. It also checks for overlapping outage records and creates separate transport alerts from recorded cool-box maximum temperatures.
- **Baseline we compared against:** Match inventory against any out-of-range reading. This intentionally broader single-reading baseline is available as a fallback in the Inventory page.
- **Result:** On the synthetic dataset provided, for 1 November 2025 to 31 October 2026, the baseline produced 23,017 candidate RBC/whole-blood units, with 28.2% precision and 97.1% recall. TrustLedger's sustained feature requires four consecutive hourly readings above the configured 6°C upper limit; it produced 6,396 candidates, with 94.5% precision and 90.4% recall. These are retrospective results against evaluation labels in the same dataset, not a held-out test. The supplied exposure label can include cool-box as well as fridge exposure, so it is not direct ground truth for fridge-only matching. Results do not establish performance on real facilities or another country.
- **How a user sees the reason for a recommendation:** The system does not generate an AI recommendation. A user can inspect the incident's facility, approximate time window, readings and rule, nearby temperature history, overlapping power records, and candidate-unit overlap window. Data Quality shows sensor glitches, duplicates, out-of-range readings, and estimated missing hours. A transport alert shows the recorded transfer maximum, but not a continuous temperature history.
- **Who approves it (Accept / Change / Reject):** A signed-in human reviewer records a decision about the **investigation flag** and supplies a reason; Change also requires a revised assessment. The server assigns the demo actor and role from the signed-in account. Both demo roles currently have the same permissions, pending role-policy confirmation. This review does not decide the blood unit's disposition.
- **What happens if the AI is wrong or offline:** A reviewer can Change or Reject an investigation flag and record why. Staff can compare with the broader single-reading baseline. If the API is offline, previously cached data may be shown with a stale warning and a review may be queued in that browser under the same demo account. It is marked Pending sync until the API accepts it. The browser cannot provide fresh data while disconnected; a queued review is not yet a server audit record.

## Data

Source: the Terumo BCT Africa Hackathon 2026 synthetic starter dataset supplied to the team. The current pipeline uses six CSV files:

| Input file             |    Rows |
| ---------------------- | ------: |
| `facilities.csv`       |      47 |
| `temperature_logs.csv` | 399,280 |
| `units.csv`            |  49,426 |
| `transfers.csv`        |  35,181 |
| `power_outages.csv`    |   2,609 |
| `donations.csv`        |  47,363 |

Other tables in the starter dataset, including routes, donors, drives, requests, and daily stock, are not used by the current processing workflow. The evaluation-only unit exposure label is used for aggregate benchmark metrics only; it is not used to detect incidents or construct candidate matches and is not returned in candidate API responses.

All supplied records are synthetic. No real donor, patient, staff, or facility records are used. The team has not verified a separate redistribution license for the organizer-provided dataset; confirm its terms with the organizers before redistributing it outside the hackathon.

## African conditions

- **Connectivity:** The browser can use cached app assets and previously loaded data, and can queue review submissions locally for later sync. Cached data may be stale. This is a single-browser fallback, not shared offline synchronization; the app has no SMS workflow.
- **Power:** The software does not provide power backup, low-power sensors, or power-failure communications. It can show correlated outage records present in the dataset, but that is not proof that an outage caused an excursion.
- **Phones and devices:** The dashboard uses a responsive web layout and can be opened in a mobile browser. It has not been validated on a representative set of low-cost phones, browsers, or connectivity conditions.
- **Language and local procedures:** The current interface is English-only. Temperature policy, terminology, roles, and escalation procedures need confirmation with the relevant blood service; the current 2–6°C rule is a prototype setting for RBC/whole blood, not a universal policy.
- **Setting up another site or country:** Site name, country label, API URL, and temperature bounds are configurable. A new deployment still needs its own authorized dataset, expert-approved rules, secure identity setup, and testing. FHIR, ISBT 128, and DHIS2 integration are not implemented.

## AI tools we used

GitHub Copilot was used to assist with code drafting, debugging, and documentation. The team is responsible for reviewing the code, validating the data interpretation, and explaining the prototype's limitations.

## Team

| Name              | Role       | Country       | Presenting Friday (in person / online) |
| ----------------- | ---------- | ------------- | -------------------------------------- |
| [Add team member] | [Add role] | [Add country] | [Add in person or online]              |
| [Add team member] | [Add role] | [Add country] | [Add in person or online]              |

## Known limits and next steps

- Confirm the user roles, review permissions, thresholds, and operating workflow with blood-service experts.
- Validate the rule against an independent dataset and real-world conditions before considering operational use.
- Integrate authorized sensor, inventory, transport, and laboratory data using agreed identifiers and data standards.
- Replace local SQLite audit storage and demo authentication with a durable, protected shared service and managed identity.
- Validate timestamps, missing-data handling, device identification, mobile behavior, and offline sync at a pilot site.
- Add approved languages and country-specific policies only after local review.

This prototype supports investigation only. It must not be used to release, quarantine, discard, declare compatible, or transfuse any blood product.
