# Decision: What does missing source data mean? — transfer-receipt challenger

**10 Nov 2026. Supersedes the provisional transfer-receipt hypothesis in `docs/OPPORTUNITY_REASSESSMENT_2026-11-10.md`.**

## User hypothesis and verified result

**Hypothesis:** Missing fields may just be absent in the dataset or at the point of recording, rather than proof that the underlying physical event failed to occur.

**Verdict: supported in the exact source generator for transfer receipts.** The organizers included `gen.py` in their synthetic starter ZIP. At source lines **395–405**, it calculates a transfer's arrival `rec`, then stores:

```python
received_at=None if rng.random() < 0.03 else rec,
```

Then separately runs:

```python
units[ui]["current_facility_id"] = dst
```

This is synthetic intentional missingness. **The generator's calculated time is not a receipt signed by a real clerk**, and source users wouldn't have that non-exported value to verify a transfer. The correct finding is **a missing receipt record**, not “unit physically missing”, “delivery never occurred” or “an unsafe unit was transfused.”

**Actual source outcomes:**
- 35,181 synthetic transfers; 1,046 have `received_at` blank (2.97%), covering 1,046 unique synthetic unit IDs.
- 873 of those units were *subsequently labelled* `transfused`. That is retrospective synthetic status, not proof of unsafe transfusion nor valid prospective evidence of receipt.
- `TRF-005463` identifies actual synthetic `unit_id=U2511-NKR-006818-RBC`, origin RBTC-NKR, destination HSP-024, dispatch 2025-11-03 09:42:45 EAT, blank receipt, recorded cool-box maximum 4.9°C. Retrospective status transfused.
- Across all 35,181 transfers, no recorded cool-box max exceeds the DATA_DICTIONARY **>10°C** excursion threshold. **Do not invent a cold-box temperature incident.**

**Temperature gaps are not the same missing-data mechanism.** `DATA_DICTIONARY.md` describes gaps as “logger was offline”. `gen.py` lines **381–386** omit temperature records during simulated logger-offline intervals. The *physical* model still simulates temperature internally, but that value is NOT available in exported logs. At decision time, you cannot infer temperature during those hours. Our 57-hour gap correctly remains **unknown**, not verified high or verified safe.

## Side-by-side test: which is the stronger 24h story?

| Criterion | Facility temperature monitoring gap | Transfer receipt missing |
|---|---|---|
| Source event | 387 logger-offline intervals, 381 resume with apparently normal temp | 1,046 transfers with missing receipt field |
| Exact blood-unit ID link | **Absent** from named-fridge history in starter CSV; supplemental DEMO fixture only | **Present** in transfers.csv, unit IDs match units.csv |
| Evidence that a physical safety incident happened | **No** during missing interval | **No**; generator intentionally hides receipt field |
| Named user/action | Operator investigates absent monitoring history, reviewer documents hold/review under site SOP | Receiving staff reconcile absent documentation; correct/timestamp receipt with proof under site SOP |
| Meaning of initial alert | **Unverified temperature environment**, a known cold-chain/data-quality failure | **Unverified documentation of transfer arrival** only |
| Clinical disposition rule from source | Requires site SOP + actual unit-location history; current simulated issue block is an illustration | Missing timestamp alone **does not justify automatic clinical quarantine** |
| Additional meaningful engineering | Already built and end-to-end tested, full source-cleaning pipeline | Would require new receipt-verification and proof workflow with no demonstrated clinical risk |
| Delivery fit | Strong within assigned cold chain + data quality scope | Strong data quality, weaker cold-chain primary story |

**Decision:** **Do not pivot the main product to transfer receipts.** Keep transfer as an optional *data quality/provenance teaching example*, not a second clinical alarm or irreversible hold. Prioritize the existing **cold-chain evidence gap → human quality review → simulated issue restriction** journey, while explicitly stating the source does **not** establish actual unit exposure. Continue to seek practitioner validation for site rules.

## Source-backed build changes (actually committed)

- `scripts/receipt_provenance_audit.py`: reproduces blank-receipt counts, exact synthetic unit linkage, and inspects generator lines; no clinical outcome inference.
- `tests/test_receipt_provenance.py`: fixture-based checks show documented missingness, linked statuses and no unsupported physical-delivery conclusion.
- `data/receipt_evidence_snapshot.json`: transparent source-level evidence and caveats.
- `index.html` Evidence Lab: optional expandable source example. It is *not* a second product or a clinical release/restriction feature.
- E2E browser test verifies the explanation and context text.

**Next engineering work:** product-critical deployment, mobile, genuine <=3min demo and eight-slide pitch. A separate receipt verification app would be scope creep unless a qualified blood-service expert establishes its actual high-priority user need.

## Competing evidence caveat
This study is possible because the supplied dataset is **synthetic and includes its generator code**. Real hospital datasets often cannot tell us directly why a receipt is blank. Production decisions require provenance, operational follow-up and documented corroboration. Data cleaning should expose unknowns, not invent facts.

## Reproduce against original organizer ZIP

```bash
python3 scripts/receipt_provenance_audit.py --source "/path/to/Hackathon Starter Dataset.zip"
python3 -m unittest discover -s tests -p "test_*.py" -v
npm test
```

No real patient, donor or hospital information was used. All observed cases and outcomes refer to synthetic generator-created records.
