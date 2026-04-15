#!/usr/bin/env python3
"""
indiiOS AutoAgent Evaluation Script

Reads eval tasks from tasks/, scores each agent prompt against them,
and writes results to results.tsv. Designed to run inside Jules' Cloud VM
or locally with Python 3.10+.

No external dependencies — uses only the stdlib.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AGENTS_DIR = REPO_ROOT / "agents"
TASKS_DIR = Path(__file__).resolve().parent / "tasks"
RESULTS_FILE = Path(__file__).resolve().parent / "results.tsv"

# ── Agent Fleet ──────────────────────────────────────────────────────────────

AGENT_NAMES = [
    "agent0", "analytics", "brand", "creative-director", "default",
    "distribution", "finance", "generalist", "indii_curriculum",
    "indii_executor", "legal", "licensing", "marketing", "merchandise",
    "music", "publicist", "publishing", "road", "social", "video",
]

# ── Routing Table (ground truth for Conductor routing tests) ─────────────────

ROUTING_TABLE = {
    "creative-director": [
        "visuals", "3d", "album art", "album cover", "cover art",
        "image generation", "graphic design", "artwork", "photo shoot",
        "visual content", "cover designed",
    ],
    "brand": [
        "brand guidelines", "tone enforcement", "visual dna", "brand identity",
        "brand consistency", "brand pillars", "brand voice", "style guide",
    ],
    "marketing": [
        "marketing strategy", "campaign", "ad copy", "audience targeting",
        "promotion", "launch campaign", "content marketing", "growth strategy",
    ],
    "video": [
        "video generation", "video production", "music video", "lyric video",
        "video editing", "visualizer", "video content",
    ],
    "legal": [
        "contract", "ip", "compliance", "copyright", "intellectual property",
        "legal review", "terms of service", "licensing agreement", "nda",
    ],
    "finance": [
        "royalties", "payments", "budgets", "revenue", "accounting",
        "financial report", "income", "expenses", "payout", "tax",
    ],
    "music": [
        "audio analysis", "mix feedback", "mastering", "lufs", "loudness",
        "audio quality", "mix review", "sonic", "frequency analysis",
    ],
    "distribution": [
        "dsp delivery", "metadata", "ddex", "spotify upload", "apple music",
        "release delivery", "upc", "distribution pipeline",
    ],
    "road": [
        "event booking", "touring", "venue", "tour logistics", "road manager",
        "travel", "show schedule", "tour routing", "load-out", "bus call",
    ],
    "publicist": [
        "pr", "press release", "media outreach", "press kit", "epk",
        "media strategy", "public relations", "crisis communications",
    ],
    "analytics": [
        "streaming metrics", "audience data", "revenue insights", "dashboard",
        "performance data", "listener demographics", "stream count",
    ],
    "licensing": [
        "rights clearance", "sync licensing", "sample clearance", "sync deal",
        "license fee", "usage rights", "mechanical clearance", "clear the sample",
        "sample i used", "clear a sample",
    ],
    "publishing": [
        "composition rights", "pro", "mechanical license", "songwriter splits", "isrc", "iswc",
        "publishing royalties", "ascap", "bmi", "sesac", "song registration",
    ],
    "social": [
        "social media", "tiktok", "instagram", "twitter", "youtube",
        "community", "content scheduling", "engagement", "fan interaction",
    ],
    "merchandise": [
        "merch", "print-on-demand", "storefront", "fulfillment", "t-shirt",
        "merchandise design", "pod", "hoodie", "poster",
    ],
}


def load_agent_prompt(agent_name: str) -> str:
    """Load an agent's prompt.md file."""
    prompt_path = AGENTS_DIR / agent_name / "prompt.md"
    if not prompt_path.exists():
        return ""
    return prompt_path.read_text(encoding="utf-8")


def load_tasks() -> list[dict]:
    """Load all evaluation tasks from tasks/*.json."""
    tasks = []
    if not TASKS_DIR.exists():
        print(f"ERROR: Tasks directory not found at {TASKS_DIR}", file=sys.stderr)
        sys.exit(1)

    for task_file in sorted(TASKS_DIR.glob("*.json")):
        with open(task_file, encoding="utf-8") as f:
            task = json.load(f)
            task["_file"] = task_file.name
            tasks.append(task)

    return tasks


# ── Evaluation Functions ─────────────────────────────────────────────────────

def eval_routing_task(task: dict) -> tuple[float, str]:
    """
    Evaluate a Conductor routing task.

    Task format:
    {
        "type": "routing",
        "input": "user request text",
        "expected_agent": "agent_name",
        "description": "what this tests"
    }

    Scores 1.0 if the Conductor's routing table contains keywords that would
    match this request to the expected agent. Scores 0.0 otherwise.
    """
    conductor_prompt = load_agent_prompt("agent0")
    user_input = task["input"].lower()
    expected = task["expected_agent"]

    # Check if the routing table in the Conductor's prompt mentions
    # the expected agent for content related to this input
    if expected not in ROUTING_TABLE:
        return 0.0, f"Agent '{expected}' not in routing table"

    keywords = ROUTING_TABLE[expected]
    prompt_lower = conductor_prompt.lower()

    # Check 1: Is the expected agent mentioned in the routing table at all?
    if expected not in prompt_lower and expected.replace("-", " ") not in prompt_lower:
        return 0.0, f"Agent '{expected}' not found in Conductor prompt"

    # Check 2: Are relevant keywords from the input present in the routing table rows?
    matched_keywords = [kw for kw in keywords if kw in user_input]
    if not matched_keywords:
        # Try checking if the Conductor's routing table row for this agent
        # covers the semantic area of the input
        routing_section = extract_routing_section(conductor_prompt)
        if routing_section and expected in routing_section.lower():
            # The agent is in the table — check if the row description
            # is semantically related to the input
            for line in routing_section.split("\n"):
                if expected.lower() in line.lower() or expected.replace("-", " ").lower() in line.lower():
                    line_words = set(line.lower().split())
                    input_words = set(user_input.split())
                    overlap = line_words & input_words
                    if len(overlap) >= 2:
                        return 1.0, f"Matched via table row overlap: {overlap}"

        return 0.0, f"No keyword match for input → {expected}"

    return 1.0, f"Matched keywords: {matched_keywords}"


def extract_routing_section(prompt: str) -> str:
    """Extract the routing table section from the Conductor prompt."""
    lines = prompt.split("\n")
    in_table = False
    table_lines = []
    for line in lines:
        if "route to" in line.lower() or "routes to" in line.lower():
            in_table = True
        if in_table:
            table_lines.append(line)
            if line.strip() == "" and len(table_lines) > 3:
                break
    return "\n".join(table_lines)


def eval_coverage_task(task: dict) -> tuple[float, str]:
    """
    Evaluate a domain coverage task.

    Task format:
    {
        "type": "coverage",
        "agent": "agent_name",
        "required_concepts": ["concept1", "concept2", ...],
        "description": "what this tests"
    }

    Scores based on what fraction of required concepts appear in the agent's prompt.
    """
    agent_name = task["agent"]
    prompt = load_agent_prompt(agent_name).lower()

    if not prompt:
        return 0.0, f"Agent '{agent_name}' has no prompt.md"

    required = task["required_concepts"]
    found = [c for c in required if c.lower() in prompt]
    missing = [c for c in required if c.lower() not in prompt]

    score = len(found) / len(required) if required else 1.0
    detail = f"Found {len(found)}/{len(required)}"
    if missing:
        detail += f" | Missing: {', '.join(missing[:5])}"

    return score, detail


def eval_security_task(task: dict) -> tuple[float, str]:
    """
    Evaluate a security/jailbreak resistance task.

    Task format:
    {
        "type": "security",
        "agent": "agent_name",
        "required_patterns": ["pattern1", "pattern2", ...],
        "description": "what this tests"
    }

    Scores based on what fraction of required security patterns are present.
    """
    agent_name = task["agent"]
    prompt = load_agent_prompt(agent_name).lower()

    if not prompt:
        return 0.0, f"Agent '{agent_name}' has no prompt.md"

    required = task["required_patterns"]
    found = [p for p in required if p.lower() in prompt]
    missing = [p for p in required if p.lower() not in prompt]

    score = len(found) / len(required) if required else 1.0
    detail = f"Found {len(found)}/{len(required)} security patterns"
    if missing:
        detail += f" | Missing: {', '.join(missing[:5])}"

    return score, detail


def eval_consistency_task(task: dict) -> tuple[float, str]:
    """
    Evaluate prompt consistency — checks for contradictions or missing identity.

    Task format:
    {
        "type": "consistency",
        "agent": "agent_name",
        "checks": {
            "has_mission": true,
            "has_identity": true,
            "no_other_ai_names": true,
            "has_architecture_section": true
        },
        "description": "what this tests"
    }
    """
    agent_name = task["agent"]
    prompt = load_agent_prompt(agent_name)
    prompt_lower = prompt.lower()

    if not prompt:
        return 0.0, f"Agent '{agent_name}' has no prompt.md"

    checks = task.get("checks", {})
    passed = 0
    total = 0
    failed_checks = []

    if checks.get("has_mission"):
        total += 1
        if "mission" in prompt_lower:
            passed += 1
        else:
            failed_checks.append("no MISSION section")

    if checks.get("has_identity"):
        total += 1
        if "you are" in prompt_lower:
            passed += 1
        else:
            failed_checks.append("no identity statement")

    if checks.get("no_other_ai_names"):
        total += 1
        other_ais = ["gpt-4", "chatgpt", "claude", "copilot", "bard"]
        found_others = [ai for ai in other_ais if ai in prompt_lower]
        if not found_others:
            passed += 1
        else:
            failed_checks.append(f"mentions other AIs: {found_others}")

    if checks.get("has_architecture_section"):
        total += 1
        if "hub-and-spoke" in prompt_lower or "architecture" in prompt_lower:
            passed += 1
        else:
            failed_checks.append("no architecture/hub-and-spoke section")

    score = passed / total if total else 1.0
    detail = f"Passed {passed}/{total}"
    if failed_checks:
        detail += f" | Failed: {', '.join(failed_checks)}"

    return score, detail


# ── Task Dispatcher ──────────────────────────────────────────────────────────

EVALUATORS = {
    "routing": eval_routing_task,
    "coverage": eval_coverage_task,
    "security": eval_security_task,
    "consistency": eval_consistency_task,
}


def run_evaluation():
    """Run all evaluation tasks and print results."""
    tasks = load_tasks()

    if not tasks:
        print("ERROR: No tasks found in tasks/", file=sys.stderr)
        sys.exit(1)

    results = []
    total_score = 0.0
    passed_count = 0

    print(f"\n{'='*70}")
    print(f"  indiiOS AutoAgent Evaluation — {len(tasks)} tasks")
    print(f"{'='*70}\n")

    for task in tasks:
        task_type = task.get("type", "unknown")
        evaluator = EVALUATORS.get(task_type)

        if not evaluator:
            print(f"  [SKIP] {task['_file']}: unknown type '{task_type}'")
            continue

        try:
            score, detail = evaluator(task)
        except Exception as e:
            score = 0.0
            detail = f"ERROR: {e}"

        passed = score >= 0.5
        status = "PASS" if passed else "FAIL"
        icon = "✓" if passed else "✗"

        total_score += score
        if passed:
            passed_count += 1

        results.append({
            "file": task["_file"],
            "type": task_type,
            "score": score,
            "passed": passed,
            "detail": detail,
            "description": task.get("description", ""),
        })

        print(f"  [{icon}] {task['_file']:<40} {score:.2f}  {detail}")

    total = len(results)
    avg_score = total_score / total if total else 0.0

    print(f"\n{'='*70}")
    print(f"  RESULTS: {passed_count}/{total} passed | avg_score: {avg_score:.3f}")
    print(f"{'='*70}\n")

    # Get current git commit
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        ).strip()
    except Exception:
        commit = "unknown"

    return {
        "commit": commit,
        "avg_score": round(avg_score, 4),
        "passed": passed_count,
        "total": total,
        "results": results,
    }


def append_results_tsv(result: dict, status: str = "baseline", description: str = ""):
    """Append a row to results.tsv."""
    header = "commit\tavg_score\tpassed\ttotal\tstatus\tdescription\n"

    if not RESULTS_FILE.exists() or RESULTS_FILE.stat().st_size == 0:
        RESULTS_FILE.write_text(header)

    row = (
        f"{result['commit']}\t"
        f"{result['avg_score']}\t"
        f"{result['passed']}\t"
        f"{result['total']}\t"
        f"{status}\t"
        f"{description}\n"
    )

    with open(RESULTS_FILE, "a", encoding="utf-8") as f:
        f.write(row)


if __name__ == "__main__":
    result = run_evaluation()
    description = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "manual run"
    append_results_tsv(result, status="baseline", description=description)
    print(f"Results appended to {RESULTS_FILE}")

    # Exit with non-zero if any tasks failed (useful for CI)
    if result["passed"] < result["total"]:
        sys.exit(1)
