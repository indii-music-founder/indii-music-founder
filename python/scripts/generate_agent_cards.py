"""Generate agent_card.json for each Python agent directory.

Phase 2.3.a — closes the asymmetry where the frontend ships 21 cards but the
sidecar's discovery returns 0. Mirrors the shape used by the TS cards under
packages/renderer/src/services/agent/a2a/cards/.

Run from repo root:
    python3 python/scripts/generate_agent_cards.py
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AGENTS_DIR = REPO_ROOT / "agents"

# Risk tier defaults — matches the frontend ToolRiskRegistry assumptions.
# Anything that writes/dispatches money or contracts is "write" or higher.
RISK_TIERS = {
    "agent0": "write",
    "analytics": "read",
    "brand": "write",
    "creative": "write",
    "default": "read",
    "distribution": "write",
    "finance": "write",
    "generalist": "read",
    "indii_curriculum": "read",
    "indii_executor": "destructive",
    "legal": "write",
    "licensing": "write",
    "marketing": "write",
    "merchandise": "write",
    "music": "write",
    "publicist": "write",
    "publishing": "write",
    "road": "write",
    "social": "write",
    "video": "write",
}

DESCRIPTIONS = {
    "agent0": "indii Conductor — central orchestration hub",
    "analytics": "Analytics agent — metrics and observability",
    "brand": "Brand specialist — identity, voice, visual system",
    "creative": "Creative specialist — concepts and content",
    "default": "Default fallback agent",
    "distribution": "Distribution specialist — delivery to DSPs and platforms",
    "finance": "Finance specialist — royalties, revenue, taxes",
    "generalist": "Generalist agent — broad-domain reasoning",
    "indii_curriculum": "Curriculum agent — onboarding and education flows",
    "indii_executor": "Executor — runs deterministic action chains",
    "legal": "Legal specialist — contracts, rights, compliance",
    "licensing": "Licensing specialist — sync, sample clearance",
    "marketing": "Marketing specialist — campaigns and audience growth",
    "merchandise": "Merchandise specialist — product, fulfillment, drops",
    "music": "Music specialist — composition, production, ISRC",
    "publicist": "Publicist specialist — press, PR, media relations",
    "publishing": "Publishing specialist — splits, registrations, royalties",
    "road": "Road specialist — touring, logistics, advancing",
    "social": "Social specialist — content scheduling, engagement",
    "video": "Video specialist — production, editing, delivery",
}


def card_for(agent_id: str) -> dict:
    return {
        "schemaVersion": "1.0.0",
        "agentId": agent_id,
        "displayName": agent_id.replace("_", " ").title() + " Agent",
        "description": DESCRIPTIONS.get(agent_id, f"{agent_id} agent."),
        "capabilities": [],
        "inputSchemas": {},
        "outputSchemas": {},
        "costModel": {"perTokenInUsd": 0.0, "perTokenOutUsd": 0.0},
        "riskTier": RISK_TIERS.get(agent_id, "read"),
        "sla": {
            "modeSync": {"p50Ms": 2000, "p99Ms": 5000},
            "modeStream": {"firstByteMs": 500},
        },
    }


def main() -> int:
    if not AGENTS_DIR.exists():
        print(f"agents/ not found at {AGENTS_DIR}")
        return 1

    written = 0
    for child in sorted(AGENTS_DIR.iterdir()):
        if not child.is_dir():
            continue
        if child.name.startswith("_") or child.name.startswith("."):
            continue
        card_path = child / "agent_card.json"
        card_path.write_text(json.dumps(card_for(child.name), indent=2) + "\n")
        written += 1
        print(f"  wrote {card_path.relative_to(REPO_ROOT)}")

    print(f"\nGenerated {written} agent cards.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
