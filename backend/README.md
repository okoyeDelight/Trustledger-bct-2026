# TrustLedger backend

FastAPI service and reproducible ingestion/validation pipeline for the Terumo BCT Africa Hackathon synthetic starter dataset.

## Setup

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r backend/requirements.txt
```

Place the organizer CSV files in `data/raw/`. Do not commit real patient or donor data. The supplied starter data is synthetic.

## Run the pipeline

```bash
cd backend
python -m app.run_pipeline --data ../data/raw --output ../data/processed
```

The pipeline creates:

- `pipeline_summary.json`
- `incidents.csv`
- `potentially_affected_units.csv`
- `baseline_candidate_units.csv`
- `unit_location_intervals.csv`
- `temperature_gaps_by_facility.csv`
- `incident_power_correlations.csv`
- `transport_temperature_alerts.csv`

The summary contains the retrospective feature-vs-baseline metrics. Evaluation labels are used only for aggregate metrics and are never returned in candidate records or used to construct operational matches.

## Start the API

From `backend/`:

```bash
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for the API explorer.

Endpoints:

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/dashboard`
- `GET /api/config`
- `GET /api/data-quality`
- `GET /api/incidents?limit=50&offset=0&search=...`
- `GET /api/incidents/{incident_id}`
- `GET /api/units/affected?limit=50&offset=0&search=...`
- `GET /api/units/affected?strategy=baseline` (single-reading fallback)
- `GET /api/units/affected/{incident_id}`
- `GET /api/power-correlations`
- `GET /api/transport-alerts?limit=50&offset=0&search=...`
- `POST /api/reviews`
- `GET /api/reviews`
- `GET /api/audit-log`

The dashboard endpoint includes calculated monthly incident trends, per-facility counts and retrospective evaluation metrics. Incident details include the surrounding facility temperature history, outage correlations and investigation-candidate units. A missing date/time separator (`YYYY-MM-DDHH:MM:SS`) is normalized while reading timestamp columns; unparseable timestamps are still treated as missing.

Review events are stored in `data/processed/review_audit.sqlite3`. Database triggers reject event updates and deletions. Review creation and audit-log reads require a signed session cookie from a pre-provisioned demo account; the server assigns the actor and role and does not accept them from the review payload. This is prototype authentication, not production identity management. Review decisions apply to the investigation flag only.
Both demo roles currently have the same review permissions. Role-specific authorization is intentionally not guessed while the organizers' role guidance is pending.

Set `TRUSTLEDGER_AUTH_SECRET` to a random secret of at least 32 characters. Provision both demo accounts with `TRUSTLEDGER_DEMO_FACILITY_USERNAME`, `TRUSTLEDGER_DEMO_FACILITY_PASSWORD`, `TRUSTLEDGER_DEMO_FACILITY_NAME`, `TRUSTLEDGER_DEMO_SUPERVISOR_USERNAME`, `TRUSTLEDGER_DEMO_SUPERVISOR_PASSWORD`, and `TRUSTLEDGER_DEMO_SUPERVISOR_NAME`; passwords must be at least 12 characters. Never put real credentials in source control. For cross-site frontend/backend hosting, configure `TRUSTLEDGER_COOKIE_SECURE=true`, `TRUSTLEDGER_COOKIE_SAMESITE=none`, and an exact frontend origin in `TRUSTLEDGER_CORS_ORIGINS`.

The API reads `TRUSTLEDGER_SITE_NAME`, `TRUSTLEDGER_COUNTRY`, `TRUSTLEDGER_TEMP_MIN_C`, and `TRUSTLEDGER_TEMP_MAX_C` from its environment. Confirm thresholds with a blood-service expert and use the same settings when rerunning the pipeline.

Transport alerts are a separate evidence stream from facility temperature incidents. The pipeline lists RBC/WB transfers whose recorded `coolbox_max_temp_c` exceeds the configured upper threshold. This field is a single maximum, not a continuous temperature history; it does not establish exposure duration or prove a unit is unsafe. The supplied temperature logger data has facility identifiers but no refrigerator or sensor identifier, so facility incidents cannot be attributed to an individual appliance.

## Safety and interpretation

- The dataset is synthetic and models a Kenyan blood system. Do not describe its findings as facts about real facilities.
- Temperature logger data is hourly. Incident start/end bounds are approximate.
- `0.0`, `-99.0`, and `99.9` are treated as known sensor glitches, not real excursions.
- The default uses the dictionary's 2–6°C red-cell/whole-blood range. The prototype supports one RBC/WB range; component-specific rules must be confirmed by the blood-service expert before broader use.
- Unit location reconstruction is conservative: a missing `received_at` makes location unknown after dispatch.
- Potentially affected units are investigation candidates only. The system does not decide product safety, compatibility, release, discard, or transfusion. A qualified person retains authority.
- `temp_excursion_exposed` is used only to calculate aggregate evaluation metrics; it is not used to detect incidents or construct exposure matches, and it is not returned by the API.
- Demo authentication has no managed identity provider, MFA, account recovery/lifecycle or production-grade abuse controls. Production requires managed authentication, blood-service-approved authorization and a protected shared audit service.
