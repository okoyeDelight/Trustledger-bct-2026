# Teammate source provenance — historical archive

The **current** TrustLedger application is in `frontend/` and `backend/`; the separate synthetic ABBIS source application is in `abbis-sandbox/`. The duplicated `candidate/teammate/` tree was never imported by the active deployment. It has been removed from `main` after preserving an exact historical branch.

- **Original contribution:** Isaac Briandt's Next.js/FastAPI prototype, pipeline and supporting project notes.
- **Original repository:** https://github.com/isaac-briandt/trustLedger-bct-hackaton-solution-2026
- **Pinned upstream revision:** `da2862ff9db262f40cd1776fd7962ed47d8942ec`.
- **Original import branch:** `integration/teammate-fastapi-nextjs`.
- **Preserved archive:** [`archive/teammate-source-snapshot-2026/candidate/teammate/`](https://github.com/okoyeDelight/Trustledger-bct-2026/tree/archive/teammate-source-snapshot-2026/candidate/teammate).
- The initial snapshot audit recorded 60 matching upstream file blobs, excluding original binary favicon, source CSV payloads and secrets. Additional metadata files were later committed under the archive.
- **Active build:** no production Vercel service, frontend package, backend import or current CI job depends on the archived path.

The archive and original Git history provide reproducibility and attribution **without maintaining two competing active implementations**. The current ABBIS loader separately verifies the complete eleven-table organizer ZIP; it does not depend on the old six-table teammate snapshot.

**Rights:** The pinned upstream source did not establish an explicit redistribution licence. Obtain appropriate teammate consent before publishing/reusing code or content; this archival operation does not grant rights.

For current build, demo, limitations and judging guidance, use the [root README](../README.md), not the historical source snapshot's obsolete TODOs.
