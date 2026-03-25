#!/usr/bin/env python3
"""
wire-r5-endpoints.py
──────────────────────────────────────────────────────────────────────────────
Queries all 20 R5 Vertex AI SFT jobs, extracts the deployed endpoint for each
completed job, and rewrites src/services/agent/fine-tuned-models.ts with the
new endpoints.

Usage:
    python3 scripts/wire-r5-endpoints.py            # dry-run (print diff)
    python3 scripts/wire-r5-endpoints.py --write    # apply changes to disk
    python3 scripts/wire-r5-endpoints.py --status   # print job status only

Requirements:
    pip install google-cloud-aiplatform
    gcloud auth application-default login
"""

import argparse
import datetime
import os
import re
import sys
from pathlib import Path

# ── R5 Job Registry (from TRAINING_LOG.md — Phase 6) ─────────────────────────
R5_JOBS: dict[str, str] = {
    "generalist":   "7741721414813614080",
    "finance":      "4427019312510795776",
    "legal":        "3555625561172738048",
    "distribution": "8720128433859854336",
    "marketing":    "6014590957717028864",
    "brand":        "2276603266999517184",
    "video":        "5854713170945376256",
    "music":        "7837422906895237120",
    "social":       "1730541812180844544",
    "publicist":    "8160556180159070208",
    "licensing":    "2072815383861002240",
    "publishing":   "2667290534673907712",
    "road":         "8225858374755942400",
    "merchandise":  "4582446276213211136",
    "director":     "9194132294640599040",
    "producer":     "172296341110652928",
    "security":     "8210095776060145664",
    "devops":       "5640792188645277696",
    "screenwriter": "6129432748214976512",
    "curriculum":   "3037711604025131008",
}

# ── Base model per agent (determines comment label) ───────────────────────────
R5_BASE_MODELS: dict[str, str] = {
    "generalist":   "gemini-2.5-pro",
    "finance":      "gemini-2.5-flash",
    "legal":        "gemini-2.5-flash",
    "distribution": "gemini-2.5-flash",
    # All others: gemini-2.5-flash-lite
}

def base_model_for(agent_id: str) -> str:
    return R5_BASE_MODELS.get(agent_id, "gemini-2.5-flash-lite")

# ── GCP config ────────────────────────────────────────────────────────────────
PROJECT   = "indiios-v-1-1"
LOCATION  = "us-central1"
PROJECT_NUMBER = "223837784072"  # numeric project ID used in endpoint URLs

# ── File paths ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
FT_MODELS_FILE = REPO_ROOT / "src" / "services" / "agent" / "fine-tuned-models.ts"


# ═════════════════════════════════════════════════════════════════════════════
# Job querying
# ═════════════════════════════════════════════════════════════════════════════

def query_jobs() -> dict[str, dict]:
    """Return a dict of agent_id -> job_info dict."""
    try:
        from google.cloud import aiplatform
    except ImportError:
        print("ERROR: google-cloud-aiplatform is not installed.")
        print("Run: pip install google-cloud-aiplatform")
        sys.exit(1)

    aiplatform.init(project=PROJECT, location=LOCATION)
    client = aiplatform.gapic.GenAiTuningServiceClient(
        client_options={"api_endpoint": f"{LOCATION}-aiplatform.googleapis.com"}
    )

    results: dict[str, dict] = {}

    for agent_id, job_id in R5_JOBS.items():
        job_name = f"projects/{PROJECT}/locations/{LOCATION}/tuningJobs/{job_id}"
        try:
            job = client.get_tuning_job(name=job_name)

            # Extract state — works on both proto-plus and raw proto objects
            state_val = getattr(job, "state", None)
            if state_val is not None:
                try:
                    from google.cloud.aiplatform_v1.types import JobState
                    state = JobState(int(state_val)).name
                except Exception:
                    state = str(state_val)
            else:
                state = "UNKNOWN"

            # Extract endpoint (populated only after SUCCEEDED)
            endpoint = None
            try:
                tuned_model = getattr(job, "tuned_model", None)
                if tuned_model:
                    endpoint_name = getattr(tuned_model, "endpoint", None) or \
                                    getattr(tuned_model, "model", None)
                    if endpoint_name:
                        m = re.search(r"/endpoints/(\d+)$", str(endpoint_name))
                        if m:
                            endpoint = f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/endpoints/{m.group(1)}"
                        else:
                            endpoint = str(endpoint_name)
            except Exception:
                pass

            results[agent_id] = {
                "job_id": job_id,
                "state": state,
                "endpoint": endpoint,
                "base_model": base_model_for(agent_id),
            }
        except Exception as e:
            results[agent_id] = {
                "job_id": job_id,
                "state": f"ERROR: {e}",
                "endpoint": None,
                "base_model": base_model_for(agent_id),
            }

    return results


# ═════════════════════════════════════════════════════════════════════════════
# TypeScript file generation
# ═════════════════════════════════════════════════════════════════════════════

# Canonical group ordering (mirrors current fine-tuned-models.ts)
AGENT_GROUPS = {
    "MANAGER'S OFFICE": ["generalist"],
    "DEPARTMENTS": ["finance", "legal", "distribution", "marketing", "social",
                    "publishing", "licensing"],
    "SPECIALISTS": ["brand", "road", "publicist", "music", "video", "devops",
                    "security", "producer", "director", "screenwriter",
                    "merchandise", "curriculum"],
}

def generate_ts(job_results: dict[str, dict], date_str: str) -> str:
    """Generate the full fine-tuned-models.ts content."""

    lines = [
        "/**",
        " * Fine-Tuned Model Registry",
        " *",
        " * Maps each agent ID to its domain-specific fine-tuned Vertex AI endpoint.",
        " * When `VITE_USE_FINE_TUNED_AGENTS=true`, BaseAgent will prefer these",
        " * endpoints over the default `AI_MODELS.TEXT.AGENT` base model.",
        " *",
        " * HOW TO UPDATE:",
        " * 1. Run `python3 scripts/wire-r5-endpoints.py --write` after R5 jobs complete",
        " * 2. Set VITE_USE_FINE_TUNED_AGENTS=true in .env",
        " */",
        "",
        "import type { ValidAgentId } from './types';",
        "",
        "// Feature flag: only use fine-tuned endpoints when explicitly enabled",
        "export const USE_FINE_TUNED_AGENTS = import.meta.env.VITE_USE_FINE_TUNED_AGENTS === 'true';",
        "",
        "/**",
        " * Registry mapping agent IDs to their fine-tuned Vertex AI model endpoints.",
        " * Entries set to `undefined` will fall back to the base model.",
        " *",
        " * Format: \"projects/{project}/locations/{location}/endpoints/{endpointId}\"",
        " */",
        "export const FINE_TUNED_MODEL_REGISTRY: Partial<Record<ValidAgentId, string>> = {",
    ]

    for group_label, agent_ids in AGENT_GROUPS.items():
        lines.append(f"    // === {group_label} ===")
        for agent_id in agent_ids:
            info = job_results.get(agent_id)
            if not info:
                lines.append(f"    '{agent_id}':{' ' * (16 - len(agent_id))}undefined,  // R5 job not found")
                continue

            bm = info["base_model"]
            state = info["state"]
            endpoint = info["endpoint"]

            if endpoint and "SUCCEEDED" in state or (endpoint and "ERROR" not in state):
                pad = " " * (16 - len(agent_id))
                lines.append(f"    // R5 — {bm} base (100 examples) — {date_str}")
                lines.append(f"    '{agent_id}':{pad}'{endpoint}',")
            elif "RUNNING" in state or "PENDING" in state or "QUEUED" in state:
                lines.append(f"    // R5 — {bm} base — job {info['job_id']} still {state}")
                lines.append(f"    '{agent_id}':{' ' * (16 - len(agent_id))}undefined,  // pending R5 completion")
            elif "FAILED" in state or "CANCELLED" in state:
                lines.append(f"    // R5 — {bm} base — job {info['job_id']} {state} — resubmit needed")
                lines.append(f"    '{agent_id}':{' ' * (16 - len(agent_id))}undefined,  // R5 job failed")
            else:
                lines.append(f"    // R5 — {bm} base — {state}")
                lines.append(f"    '{agent_id}':{' ' * (16 - len(agent_id))}undefined,")

        lines.append("")  # blank line between groups

    # keeper — never fine-tuned
    lines.append("    // Not yet fine-tuned")
    lines.append("    'keeper':           undefined,")
    lines.append("};")
    lines.append("")
    lines.append("/**")
    lines.append(" * Get the fine-tuned model endpoint for an agent, or undefined to use base model.")
    lines.append(" * Returns `undefined` when:")
    lines.append(" * - Feature flag is disabled")
    lines.append(" * - Agent has no fine-tuned endpoint registered")
    lines.append(" * - Endpoint is set to undefined (not yet available)")
    lines.append(" */")
    lines.append("export function getFineTunedModel(agentId: ValidAgentId): string | undefined {")
    lines.append("    if (!USE_FINE_TUNED_AGENTS) return undefined;")
    lines.append("    return FINE_TUNED_MODEL_REGISTRY[agentId];")
    lines.append("}")
    lines.append("")

    return "\n".join(lines)


# ═════════════════════════════════════════════════════════════════════════════
# Status report
# ═════════════════════════════════════════════════════════════════════════════

def print_status(job_results: dict[str, dict]) -> None:
    done   = [(k, v) for k, v in job_results.items() if "SUCCEEDED" in v["state"]]
    active = [(k, v) for k, v in job_results.items() if any(s in v["state"] for s in ("RUNNING", "PENDING", "QUEUED"))]
    failed = [(k, v) for k, v in job_results.items() if any(s in v["state"] for s in ("FAILED", "CANCELLED", "ERROR"))]

    print(f"\n{'═' * 60}")
    print(f"  R5 SFT Job Status  ({datetime.date.today()})")
    print(f"{'═' * 60}")
    print(f"  ✅  SUCCEEDED : {len(done):>2} / {len(job_results)}")
    print(f"  🔄  IN FLIGHT : {len(active):>2} / {len(job_results)}")
    print(f"  ❌  FAILED    : {len(failed):>2} / {len(job_results)}")
    print(f"{'─' * 60}")

    for agent_id, info in sorted(job_results.items()):
        state = info["state"]
        ep = info["endpoint"]
        icon = "✅" if "SUCCEEDED" in state else ("🔄" if any(s in state for s in ("RUNNING", "PENDING", "QUEUED")) else "❌")
        ep_str = f"  → {ep}" if ep else ""
        print(f"  {icon}  {agent_id:<14} {state}{ep_str}")

    print(f"{'═' * 60}\n")

    if active:
        eta_hours = 2
        print(f"  {len(active)} job(s) still running — check back in ~{eta_hours}h")
        print(f"  Re-run: python3 scripts/wire-r5-endpoints.py --write\n")
    elif len(done) == len(job_results) - len(failed):
        print("  All jobs complete — ready to wire endpoints!\n")


# ═════════════════════════════════════════════════════════════════════════════
# Diff helper
# ═════════════════════════════════════════════════════════════════════════════

def show_diff(old_content: str, new_content: str) -> None:
    import difflib
    diff = list(difflib.unified_diff(
        old_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile="fine-tuned-models.ts (current)",
        tofile="fine-tuned-models.ts (R5 wired)",
    ))
    if diff:
        print("".join(diff))
    else:
        print("(no changes — all endpoints already match)")


# ═════════════════════════════════════════════════════════════════════════════
# Entry point
# ═════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Wire R5 fine-tuned model endpoints into fine-tuned-models.ts"
    )
    parser.add_argument("--write",  action="store_true", help="Write updated file to disk")
    parser.add_argument("--status", action="store_true", help="Print job status only (no file output)")
    args = parser.parse_args()

    print("Querying 20 R5 tuning jobs...")
    job_results = query_jobs()

    print_status(job_results)

    if args.status:
        return

    date_str = datetime.date.today().isoformat()
    new_ts = generate_ts(job_results, date_str)

    if args.write:
        old_ts = FT_MODELS_FILE.read_text() if FT_MODELS_FILE.exists() else ""
        if new_ts == old_ts:
            print("fine-tuned-models.ts is already up to date.")
        else:
            show_diff(old_ts, new_ts)
            FT_MODELS_FILE.write_text(new_ts)
            print(f"\n✅  Wrote: {FT_MODELS_FILE}")
            print("   Next: git add src/services/agent/fine-tuned-models.ts && git commit -m 'chore(training): wire R5 endpoints'")
    else:
        # Dry-run: show diff only
        old_ts = FT_MODELS_FILE.read_text() if FT_MODELS_FILE.exists() else ""
        print("\n── Dry-run diff (use --write to apply) ──────────────────────\n")
        show_diff(old_ts, new_ts)


if __name__ == "__main__":
    main()
