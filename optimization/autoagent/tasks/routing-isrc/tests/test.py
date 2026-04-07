#!/usr/bin/env python3
"""Verifier for routing-isrc.

Reads /task/answer.txt and checks that the Conductor routed to `publishing`.
ISRC registration is a Performing Rights Organization / song registration
concern, which lives under the publishing specialist in indiiOS.
"""
import sys
from pathlib import Path

EXPECTED = "publishing"
ANSWER_FILE = Path("/task/answer.txt")

if not ANSWER_FILE.exists():
    print(f"FAIL: {ANSWER_FILE} does not exist", file=sys.stderr)
    sys.exit(1)

actual = ANSWER_FILE.read_text().strip().lower()
if actual != EXPECTED:
    print(f"FAIL: expected {EXPECTED!r}, got {actual!r}", file=sys.stderr)
    sys.exit(1)

print(f"PASS: routed to {EXPECTED}")
sys.exit(0)
