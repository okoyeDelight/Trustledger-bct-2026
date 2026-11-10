#!/usr/bin/env python3
"""Build a *reviewable*, explicitly allowlisted TrustLedger submission snapshot.

Important: this does NOT publish, copy Git history, create a second repo,
prove current private history can be published, or satisfy the organizer's
one-repository-per-team/commit-history rule by itself. The organizer must
approve any different submission-repository approach.

Usage: python3 scripts/build_judge_bundle.py --out ./_judge_package
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ALLOWED = (
    "index.html", "styles.css", "service-worker.js",
    "src/app.js", "src/engine.js", "src/source_evidence.js", "src/custody_fixtures.js",
    "package.json", "playwright.config.mjs",
    "e2e/core.spec.mjs", "e2e/visual.spec.mjs",
    "tests/engine.test.mjs",
    "tests/test_audit_starter.py", "tests/test_build_source_evidence.py",
    "tests/test_receipt_provenance.py", "tests/test_system_pressure.py",
    "scripts/audit_starter.py", "scripts/build_source_evidence.py",
    "scripts/receipt_provenance_audit.py", "scripts/system_pressure.py",
    "data/PROVENANCE.md", "data/quality_audit_snapshot.json",
    "data/receipt_evidence_snapshot.json", "data/system_pressure_snapshot.json",
    "docs/PRODUCT_SCOPE.md", "docs/DATA_QUALITY_PIPELINE.md",
    "docs/ARCHITECTURE_FOR_JUDGES.md", "docs/JUDGING_EVIDENCE_MAP.md",
    "submission/DEMO_SCRIPT_3_MIN.md", "submission/PITCH_8_SLIDES.md",
    ".github/workflows/verify.yml", ".github/workflows/browser-evaluator.yml",
    ".github/workflows/deploy-pages.yml", ".gitignore",
)
README_SOURCE = "submission/PUBLIC_README.md"

# A deliberately strict *screen*, not a guarantee of legal/commercial safety.
BLOCKED_CONTENT = (
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"sk-(?:proj|live|test)-[A-Za-z0-9_-]{18,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)\b(?:secret[_-]?key|api[_-]?key|access[_-]?token)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]"),
    re.compile(r"(?i)hany@talo\.africa"),
    re.compile(r"(?i)OKOYE\s+CHIAGOZIE\s+DELIGHT"),
    re.compile(r"(?i)kickoff[_ -]recording\.mp4"),
)
ALLOWED_EXT = {".html", ".css", ".js", ".mjs", ".py", ".json", ".md", ".yml", ".yaml"}
ALLOWED_SPECIAL = {".gitignore"}

def scan_text(rel: str, content: str):
    for pattern in BLOCKED_CONTENT:
        if pattern.search(content):
            raise ValueError(f"Blocked source content pattern in {rel}: {pattern.pattern}")
    # No outbound email addresses in release; source citations should be URLs.
    if re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", content):
        raise ValueError(f"Unexpected email address in public candidate: {rel}")

def build(out: Path, root: Path = ROOT):
    root = root.resolve()
    out = out.resolve()
    if out == root or root in out.parents and out.name in {"src", "docs", "submission"}:
        raise ValueError("Cannot overwrite source directories")
    # Existing out must be empty; this avoids accidentally mixing unapproved old files.
    if out.exists() and any(out.iterdir()):
        raise ValueError(f"Output is not empty: {out}")
    file_map = [(path, path) for path in ALLOWED] + [(README_SOURCE, "README.md")]
    staged = []
    for original, release in file_map:
        path = Path(original)
        target = Path(release)
        if path.is_absolute() or ".." in path.parts or target.is_absolute() or ".." in target.parts:
            raise ValueError("Paths must remain under source/output roots")
        src = (root / path).resolve()
        if root not in src.parents or not src.is_file():
            raise FileNotFoundError(f"Expected approved source file not found: {original}")
        if src.suffix not in ALLOWED_EXT and src.name not in ALLOWED_SPECIAL:
            raise ValueError(f"Unexpected extension: {original}")
        body = src.read_text(encoding="utf-8")
        scan_text(release, body)
        staged.append((src, target, body))
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"project": "TrustLedger", "type": "explicitly allowlisted synthetic demo snapshot",
                "history_warning": "This snapshot has no original Git history; organizer approval and separate original-commit verification are required before any second-repo submission.",
                "included": []}
    for src, rel, content in staged:
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        manifest["included"].append({
            "path": rel.as_posix(), "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            "bytes": len(content.encode("utf-8"))
        })
    (out / "RELEASE_MANIFEST.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return manifest

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=Path("_judge_package"))
    args = p.parse_args()
    result = build(args.out)
    print(f"Staged {len(result['included'])} allowlisted files in {args.out}; no history or private team notes copied.")
