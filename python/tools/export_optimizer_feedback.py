"""Export optimizer feedback to a Gemini-fine-tune-ready JSONL dataset.

Phase 4.5.c — converts the sidecar's append-only feedback log
(python/data/optimizer_feedback.jsonl) into a structured corpus where each
line is `{prompt, ideal_response, signal}`.

Usage:
    python3 python/tools/export_optimizer_feedback.py [--out PATH]
                                                       [--since TS]
                                                       [--min-score N]
                                                       [--exemplar TYPE]
                                                       [--agent ID]
                                                       [--positive-only]

Default: writes to python/data/finetune_export_<epoch>.jsonl, includes only
positive exemplars with score >= 8, agent filter optional.

Manual export trigger only — never auto-uploads anywhere.
"""

import argparse
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_INPUT = REPO_ROOT / "python" / "data" / "optimizer_feedback.jsonl"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "python" / "data"


def _read_records(path: Path):
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                print(
                    f"warn: skipping malformed line {line_no}: {exc}",
                    file=sys.stderr,
                )


def _passes_filters(rec: dict, args: argparse.Namespace) -> bool:
    if args.since is not None and rec.get("ts", 0) < args.since:
        return False
    if args.min_score is not None and rec.get("score", 0) < args.min_score:
        return False
    if args.exemplar and rec.get("exemplarType") != args.exemplar:
        return False
    if args.agent and rec.get("agentId") != args.agent:
        return False
    if args.positive_only and rec.get("exemplarType") != "positive":
        return False
    return True


def _to_finetune_row(rec: dict) -> dict | None:
    """Shape: {prompt, ideal_response, signal}.

    A row needs at least a prompt or an ideal_response to be useful for
    fine-tuning. Records lacking both are skipped.
    """
    prompt = rec.get("prompt")
    ideal_response = rec.get("idealResponse")
    if not prompt and not ideal_response:
        return None
    return {
        "prompt": prompt or "",
        "ideal_response": ideal_response or "",
        "signal": {
            "agentId": rec.get("agentId"),
            "score": rec.get("score"),
            "dimension": rec.get("dimension"),
            "exemplarType": rec.get("exemplarType"),
            "conversationId": rec.get("conversationId"),
            "turnId": rec.get("turnId"),
            "ts": rec.get("ts"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--since", type=float, default=None,
                        help="Only include records with ts >= this epoch")
    parser.add_argument("--min-score", type=float, default=8.0,
                        help="Minimum score to include (default 8.0)")
    parser.add_argument("--exemplar", choices=["positive", "negative", "neutral"],
                        default=None)
    parser.add_argument("--agent", type=str, default=None,
                        help="Filter to a single agentId")
    parser.add_argument("--positive-only", action="store_true", default=True,
                        help="Default: only export positive exemplars")
    parser.add_argument("--include-all-exemplars", action="store_true",
                        help="Override --positive-only and include all")
    args = parser.parse_args()

    if args.include_all_exemplars:
        args.positive_only = False

    if args.out is None:
        DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        args.out = DEFAULT_OUTPUT_DIR / f"finetune_export_{int(time.time())}.jsonl"

    written = 0
    skipped = 0
    with args.out.open("w", encoding="utf-8") as out:
        for rec in _read_records(args.input):
            if not _passes_filters(rec, args):
                skipped += 1
                continue
            row = _to_finetune_row(rec)
            if row is None:
                skipped += 1
                continue
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1

    print(f"Wrote {written} rows to {args.out.relative_to(REPO_ROOT)}")
    print(f"Skipped {skipped} records (filtered or empty payloads)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
