# TrustLedger demo video plan (maximum 3 minutes)

**Status:** recording guide only. The team must record and attach the actual video; this file is not a recording.

## Preparation

- Start the pipeline, API and frontend using the root README.
- Open the dashboard and wait for live API data and the feature-vs-baseline comparison.
- Open an incident detail with temperature history and at least one candidate unit.
- In the Review centre, use a synthetic reviewer name and select either demo role.
- Keep the API log visible if recording a split-screen; do not show secrets or any real personal/health data.

## Timed walkthrough

| Time | Show / say |
|---|---|
| 0:00–0:20 | Name the user: a facility cold-chain officer. Explain that this synthetic-data prototype turns hourly temperature records into an investigation queue, not a clinical disposition. |
| 0:20–0:55 | Show the overview: live incident totals, facility monitoring and quality counts. Point out the data feature vs one-reading baseline, including both candidate counts, precision and recall. State that the benchmark uses the same synthetic dataset's evaluation labels and is not held out. |
| 0:55–1:25 | Open a sustained facility incident. Show the temperature timeline, rule reason, outage context and candidate-unit list. Point out that the data has no fridge/sensor ID, so the incident is facility-level. Explain that missing receipts and sensor glitches are surfaced, not guessed away. |
| 1:25–1:40 | Open Transport temperature alerts. Show a transfer with a cool-box maximum above the configured RBC/WB threshold. Explain that this is a separate transport evidence stream and the single maximum does not show duration or prove unit exposure. |
| 1:40–2:00 | Show Review centre. Select a demo role, choose Accept / Change / Reject, add a reason and save. Say explicitly that the decision applies only to the investigation flag and does not release or quarantine a unit. |
| 2:00–2:15 | Open Audit log. Point to the actor, demo role, time, reason and immutable event behavior. Explain that the demo role is not authentication. |
| 2:15–2:40 | Demonstrate offline fallback: after the app has cached its pages/data, disconnect the API/network, show the stale/offline banner, and (optionally) queue a review. Reconnect and show pending-sync status clearing. Do not imply stale data is current. |
| 2:40–3:00 | Close with the architecture diagram, future HL7 FHIR / ISBT 128 mapping, and the next validation step: review workflow, threshold and country configuration with a blood-service expert. |

## Recording checks

- Keep the final video at or below 3 minutes.
- Show the application actually running; do not substitute a clickable mock-up or narrated slides for the working workflow.
- Make the baseline/feature numbers readable and describe the recall trade-off.
- Include the human decision and audit entry, and clearly label demo roles.
- Show one offline or sync-fallback state and label cached data as potentially stale.
- Keep transport maximums distinct from facility incidents; describe both as investigation evidence only.
- Record only synthetic data. Do not include real donor, patient, staff credential or facility data.
