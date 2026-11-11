#!/usr/bin/env python3
"""Download upstream synthetic CSV inputs pinned to a known Git commit.

Run from this copied candidate project:
    python3 tools/fetch_synthetic_inputs.py

Never use this script for real patient, donor or facility records.
"""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

UPSTREAM = "isaac-briandt/trustLedger-bct-hackaton-solution-2026"
REVISION = "da2862ff9db262f40cd1776fd7962ed47d8942ec"
ROOT = Path(__file__).resolve().parents[1]


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def main() -> None:
    manifest = json.loads((ROOT / "data-source-manifest.json").read_text(encoding="utf-8"))
    if manifest["source_repository"] != UPSTREAM or manifest["source_revision"] != REVISION:
        raise SystemExit("Unexpected source manifest, refusing to download")
    for item in manifest["synthetic_csv_inputs"]:
        path = item["path"]
        if not path.startswith("backend/data/raw/") or not path.endswith(".csv"):
            raise SystemExit("Unexpected file path, refusing to download")
        destination = ROOT / path
        url = "https://raw.githubusercontent.com/" + UPSTREAM + "/" + REVISION + "/" + path
        req = Request(url, headers={"User-Agent": "TrustLedger-source-pinned-import"})
        with urlopen(req, timeout=120) as response:
            content = response.read(item["bytes"] + 1)
        if len(content) != item["bytes"] or git_blob_sha1(content) != item["git_sha1"]:
            raise SystemExit("Source verification failed for " + path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        print("Verified " + path + " (" + str(len(content)) + " bytes)")


if __name__ == "__main__":
    main()
