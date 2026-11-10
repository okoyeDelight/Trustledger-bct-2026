# New organizer SQLite dataset — schema reconciliation (10 Nov 2026)

**Source location:** organizer-accessible [Applicant's Kit Drive folder](https://drive.google.com/drive/folders/1e4gcSnUvbao73maOT3-THjgUBtMQJDa-), newly visible extracted subfolder `terumo-hackathon-2026-starter-dataset`, containing `blood_system.sqlite` (44 MiB; 45,514,752 bytes). **Source is synthetic**, not clinical data. The folder's visible creation date is 10 Nov 2026 ~16:16 UTC. This note does NOT claim that the internal SQLite binary was generated today; its metadata indicates an earlier modification timestamp.

## Reconciliation: original organizer starter CSV ZIP vs SQLite

**Method:** Opened the downloaded database in read-only SQLite mode and compared each table's `PRAGMA table_info` names and `SELECT COUNT(*)` against the same-named CSV header and row count in the previously supplied starter ZIP.

| Source table | SQLite rows | Original CSV rows | Headers match |
|---|---:|---:|---|
| daily_stock | 185,785 | 185,785 | yes |
| donations | 47,363 | 47,363 | yes |
| donors | 43,363 | 43,363 | yes |
| drives | 1,091 | 1,091 | yes |
| facilities | 47 | 47 | yes |
| power_outages | 2,609 | 2,609 | yes |
| requests | 17,430 | 17,430 | yes |
| routes | 2,162 | 2,162 | yes |
| temperature_logs | 399,280 | 399,280 | yes |
| transfers | 35,181 | 35,181 | yes |
| units | 49,426 | 49,426 | yes |

**Caution:** Equal schema and counts do not *prove row-by-row identity*. Do not claim SQLite adds new unit-linked cold-chain observations without explicit comparison and evidence.

The SQLite schema has **no device/fridge ID or equipment-to-unit occupancy table**. No declared SQLite foreign keys and no explicit indexes were found. It does expose common facility/unit/donation/transfer/request IDs, but these are not a historical refrigerator-location feed.

**Checked known cases:**
- HSP-024, 2026-09-30 09:00–2026-10-02 19:00 EAT: only two endpoint rows at 3.9°C and 4.3°C, confirming the source's **57 expected missing hourly values**.
- RBTC-NBO source outage `OUT-00009` remains 2026-10-05 22:18:42 to 2026-10-06 02:08:39, duration 3.83h and backup power not engaged.
- `transfers.received_at` has 1,046 blank/NULL values, a documentation field. Missing receipt does not prove physical non-arrival.

## Engineering decision

**Do not restart the frontend or pretend a real shared backend is now in place.** The organizer's SQLite is a *source dataset format* (queryable offline); it does not create a server, authenticated staff accounts, a device feed, cloud synchronization or clinical sign-off.

Our browser-first cold-chain evidence → simulated human review → mock issue guard continues to demonstrate one working hackathon workflow. SQLite could make source queries and joins more convenient in a future backend adapter, but a new server implementation would jeopardize the 11 November deadline without yet closing clinical traceability.

## Expert validation status

The team's screenshots show **Isaac saying he already contacted the blood-service expert**. Actual expert feedback is **not yet supplied**. Wait for the real answer before changing the role names, disposition procedure or assignment/escalation rules.

**Ask the expert to clarify:** (1) Who opens and assigns fridge-monitoring incidents? (2) How is escalation triggered, to whom and on what evidence? (3) Who has authority to close an incident or release/quarantine/discard a unit according to local SOP? (4) What equipment- and unit-location records exist and can be connected? (5) How would staff receive or reconcile a case handoff?

The available synthetic data cannot answer these operational questions.

## Immediate priority

Keep the code stable, confirm the team's check-in at Tue 10 Nov **18:00 WAT**, publish a judge-accessible synthetic-only live demo without exposing historical private notes, record a genuine <=3-minute walkthrough, finish the eight-slide presentation. Final submission Wed 11 Nov **10:00 WAT**.
