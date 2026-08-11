---
name: skill-skill
description: Canonical capability planner for selecting the smallest healthy toolchain for a task. Use when the user invokes /skill-skill, asks which skill or tool to use, when routing is ambiguous, when a preferred capability is unavailable, or before a complex task that needs several workflows, skills, scripts, connectors, or host tools.
---

# Skill-Skill

Route through the canonical implementation in [`../../workflows/skill-skill.md`](../../workflows/skill-skill.md). This skill is the host-discoverable adapter; it must not maintain a second static routing table.

## Required inputs

1. Read `.agent/capabilities/catalog.md` and confirm its source digest is current with `npm run validate:capabilities` when repository execution is available.
2. Overlay only the tools, connectors, MCP capabilities, browser/computer-use capabilities, and user-global skills actually exposed in the current session.
3. Read `.agent/capabilities/CONTRACT.md` when a candidate has external, destructive, delivery, authentication, or material-cost effects.

## Selection behavior

- Classify request mode, risk profile, and existing authority before choosing tools.
- Select the minimal sufficient ordered toolchain, including a verifier when the task changes state.
- Auto-select Certified capabilities. Select Conditional capabilities only after all prerequisites pass.
- Never select Quarantined, Deprecated, unavailable, or stale capabilities.
- Reject near matches explicitly when their authority, proof type, prerequisites, or scope do not fit.
- Re-route after repeated failure or unavailable prerequisites instead of retrying indefinitely.
- Execute inside the active request when safe. Pause only for new authority, official sign-in, destructive or irreversible action, material cost, external communication, or a goal-changing decision.

## Output

Use the route schema defined by the canonical workflow. Routing never expands the user's authority; selected tools inherit it.
