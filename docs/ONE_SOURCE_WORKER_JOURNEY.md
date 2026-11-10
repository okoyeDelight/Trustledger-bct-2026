# TrustLedger's minimum worker journey — one synthetic monitoring source

**Product decision:** one clear workflow is the MVP; more dashboards, analytics or other blood-bank modules are out of scope.

## First-time worker question

> “Is there a monitoring problem at my facility that needs my attention, and what do I do next?”

Use **one organizer-source-backed HSP-024 case**. The facility temperature feed has a 57-hour gap and a last observation of 4.2°C. The source is **facility-level data only**, not proof a physical device or blood unit was affected. No live reader, login or clinical release is connected.

## Screen map

| Screen | Why it exists | What a person learns | One primary action |
|---|---|---|---|
| **Incidents** | Gives the worker an inbox | HSP-024, missing 57 expected readings, needs investigation | **Open incident** |
| **Understand** | Prevents guessing from the latest value | Exact source observations on each side of a blank gap; normal observed values do not fill missing hours | **Start investigation** |
| **Investigate** | Captures documented observations instead of one-click alarms | What records were checked, what remains unverified and the recommended next action | **Submit for review** |
| **Review** | Demonstrates a second human decision | Operator recommendation plus actual source context; reviewer can accept, change to hold or return for more information | **Record review decision** |
| **Follow up** | Separates paperwork closure from clinical clearance | The authorized demo recommendation, missing supporting evidence and downstream site authority action | **Record outcome** |
| **Documented outcome** | Makes the result and remaining risk obvious | A readable status, local case activity and continuing restriction; no claim of safe blood | **Return to incidents** |

**Case history** is folded into the relevant incident rather than being an equally prominent application destination.

## UI rules

- One main case per pilot, no promotional hero, huge KPIs, badges everywhere or scientific research front-and-centre.
- Never present 2–6°C as a clinically validated hospital SOP; source data in this case are synthetic and engineering rules illustrative.
- Missing temperature data are **blank**, not interpolated. Date/time in East Africa Time.
- Operator and reviewer are both **simulated in one browser**; role identity is not verified.
- “Return for more information” must be usable; the operator can resubmit with a revised finding.
- “Outcome documented” never means a suspect blood unit is safe.
- A test mock issue uses a deliberately fictional unit ID only at the end. It remains blocked; no physical release is authorized.
- No claim that an actual refrigerator device/reader is integrated. The one monitoring feed is a static original-source excerpt.
- Local demo state and events live in browser storage only; no shared database or immutable audit.

## Implemented software wiring

- `pilot/index.html`: single-product shell, not the old multisection dashboard.
- `pilot/pilot.css`: responsive visual hierarchy.
- `pilot/pilot.js`: six-screen workflow with recorded local progress.
- `src/engine.js`: existing tested `inspectEvidence`, `propose`, `review`, `closeReview`, `issueGuard`. These remain unchanged.
- `src/source_evidence.js`: raw selected readings generated from the organizer's synthetic `temperature_logs.csv`.
- `e2e/pilot.spec.mjs`: five browser journeys across desktop, Pixel and 360px mobile.

**Run locally** from the repository root:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080/pilot/
```

## The hybrid product direction beyond this one-source pilot

Both **automatic monitoring** and **manual staff reporting** should feed the same incident workflow. This pilot implements only the source-backed detection example, not manual incident creation and not live ingestion. A later increment can add an essential-fields manual reporting form when this single worker journey is verified.

## Gate to expand scope

Have a person who hasn't seen TrustLedger try: open incident, explain the 57-hour gap, record findings, submit, review, record follow-up, verify the block and return to the inbox. They should be able to do that **without a live walkthrough from us**. If not, fix confusing workflow or wording before adding features.

The pending expert interview must validate actual roles, assignment, escalation, SOP evidence requirements and closure before any real clinical use. This prototype does not replace those procedures.
