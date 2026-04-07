#!/usr/bin/env python3
"""sync_winning_prompt.py — extract the meta-agent's winning SYSTEM_PROMPT
from optimization/autoagent/agent.py and write it into the canonical
indii Conductor prompt file at agents/agent0/prompt.md.

Run by the nightly GH Actions workflow AFTER `harbor run` finishes. The
workflow then creates a PR with the diff so a human reviews every prompt
change before it ships.

This script is intentionally simple and side-effect-aware:
  - It does NOT touch agent.py (treat it as the source of truth from autoagent)
  - It does NOT push or create PRs (the workflow does that with `gh`)
  - It DOES exit non-zero if the prompt is unchanged so the workflow can skip
    PR creation when there's nothing to ship

Usage:
    python scripts/sync_winning_prompt.py [--dry-run]

Exit codes:
    0  = prompt was changed and written to agents/agent0/prompt.md
    1  = error (couldn't parse, couldn't read/write)
    2  = no change (prompt identical to current Conductor prompt) — workflow
         should treat this as "skip PR" and not as a failure
"""

from __future__ import annotations

import argparse
import ast
import sys
from pathlib import Path

# Anchor everything off this script's location so it works no matter where
# it's invoked from. The repo layout is:
#   <repo>/optimization/autoagent/scripts/sync_winning_prompt.py
#   <repo>/optimization/autoagent/agent.py
#   <repo>/agents/agent0/prompt.md
SCRIPT_DIR = Path(__file__).resolve().parent
AUTOAGENT_DIR = SCRIPT_DIR.parent
REPO_ROOT = AUTOAGENT_DIR.parent.parent
AGENT_PY = AUTOAGENT_DIR / "agent.py"
CONDUCTOR_PROMPT = REPO_ROOT / "agents" / "agent0" / "prompt.md"


def extract_system_prompt(agent_py_path: Path) -> str:
    """Parse agent.py and return the value of the top-level SYSTEM_PROMPT string.

    Uses ast (not regex) so it correctly handles triple-quoted strings,
    escapes, and any whitespace the meta-agent introduces.
    """
    if not agent_py_path.exists():
        raise FileNotFoundError(f"agent.py not found at {agent_py_path}")

    source = agent_py_path.read_text()
    tree = ast.parse(source, filename=str(agent_py_path))

    for node in tree.body:
        # We're looking for: SYSTEM_PROMPT = "..."  (or = """...""")
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "SYSTEM_PROMPT":
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                        return node.value.value
                    raise ValueError(
                        "SYSTEM_PROMPT exists but is not a plain string literal. "
                        "The meta-agent likely introduced an f-string or concat — "
                        "the sync script does not support that yet."
                    )

    raise ValueError(f"No top-level SYSTEM_PROMPT assignment found in {agent_py_path}")


def write_conductor_prompt(prompt: str, target_path: Path, *, dry_run: bool) -> int:
    """Write `prompt` to `target_path`. Returns exit code per the contract above."""
    target_path.parent.mkdir(parents=True, exist_ok=True)

    new_content = prompt.rstrip() + "\n"  # canonical: trailing newline, no trailing whitespace
    if target_path.exists():
        existing = target_path.read_text()
        if existing == new_content:
            print(f"NO CHANGE: {target_path} already matches winning prompt")
            return 2

    if dry_run:
        print(f"DRY RUN: would write {len(new_content)} bytes to {target_path}")
        print("--- begin prompt ---")
        print(new_content)
        print("--- end prompt ---")
        return 0

    target_path.write_text(new_content)
    print(f"WROTE: {target_path} ({len(new_content)} bytes)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print but do not write")
    args = parser.parse_args()

    try:
        prompt = extract_system_prompt(AGENT_PY)
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not prompt.strip():
        print("ERROR: extracted SYSTEM_PROMPT is empty", file=sys.stderr)
        return 1

    return write_conductor_prompt(prompt, CONDUCTOR_PROMPT, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
