# Teammate application — preserved upstream snapshot

**Source:** https://github.com/isaac-briandt/trustLedger-bct-hackaton-solution-2026
**Source revision:** `da2862ff9db262f40cd1776fd7962ed47d8942ec`
**Imported into private repo:** `candidate/teammate/` on `integration/teammate-fastapi-nextjs`.

This preserves the original Next.js frontend, Python FastAPI backend, processing pipeline, tests, package lockfile and documentation as **60 byte-for-byte Git blob matches**. We do not modify the original team's application code in this snapshot. The import is not yet integrated with the TrustLedger Neon + Clerk branch, does not replace the existing Vercel production site and has not been run end-to-end here.

## Deliberate omissions

- Original upstream `frontend/src/app/favicon.ico` (binary image asset, not a source-code file).
- Six supplied synthetic CSV files totaling ~27 MB. Their **pinned upstream blob SHA-1s** and sizes are recorded in `data-source-manifest.json`; download with `python3 tools/fetch_synthetic_inputs.py` if reproducing the upstream pipeline locally or in a controlled build. This downloader validates both file size and Git blob hash and does not copy credentials.
- No deployment secrets, `.env` with real credentials, or Git history are imported.

This is **a staged code copy, not a GitHub fork or a completed application migration**. Retain both implementations until the data, security, review workflow and deployment have been verified. The upstream project did not show a LICENSE file at this revision; obtain the teammate's explicit permission before redistribution or hackathon submission from our repository, and retain author credit.

## Next technical steps

1. Install dependencies and run imported unit tests using pinned dataset inputs.
2. Review difference between original dataset records and transformed candidate unit claims, and reconcile any case-count discrepancies.
3. Agree on exactly one canonical working repo with the teammate.
4. Replace SQLite local audit persistence with separately configured Neon, enforce distinct worker/reviewer permissions, and assess Clerk integration; avoid duplicating two auth flows.
5. Add manual incident reporting, investigation submission and follow-up as single worker-first journey.
6. Deploy as a preview only after security tests pass. Do not merge or replace the production site yet.
