# AutoAgent Setup & Runbook

This document covers everything needed to operate the nightly Jules-powered
routing optimization workflow for the indii Conductor system prompt.

---

## What this enables

A GitHub Actions workflow (`.github/workflows/jules-autoagent.yml`) invokes
[Jules](https://jules.google) — Google's remote AI coding agent — against the
indii Conductor's routing table every night. Jules:

1. Reads the Conductor system prompt (`agents/conductor/prompt.md`)
2. Reads every spoke agent prompt (`agents/*/prompt.md`)
3. Reads the Conductor's domain skill SOPs (`agents/conductor/skills/*/SKILL.md`)
4. Cross-references routing keywords against each specialist's actual scope
5. Identifies coverage gaps, routing conflicts, stale references, and missing
   specialists
6. Opens a PR with surgical routing table improvements (if any are found)

A human reviews and merges every PR. The nightly job never modifies prod
agent behavior on its own.

---

## Architecture

This workflow uses the official
[`google-labs-code/jules-action`](https://github.com/google-labs-code/jules-action)
GitHub Action. Jules is a remote cloud coding agent (not a local Python
meta-agent). It:

- Clones the repo into a cloud VM
- Reads the files specified in the prompt
- Makes edits and creates a PR if improvements are found
- Runs autonomously — no Docker-in-Docker, no Harbor, no `agent.py` wrapper

### Historical context

This workflow supersedes the original `kevinrgu/autoagent` Python meta-agent
approach (documented in `.agent/AUTOAGENT_HANDOFF.md`). That approach required:
- A `optimization/autoagent/` sidecar directory with Harbor eval tasks
- Docker-in-Docker on the runner
- An `OPENAI_API_KEY` for the meta-agent's LLM calls
- A `sync_winning_prompt.py` script to extract prompt deltas

None of that infrastructure was ever built (Phase A was "zero code written").
The Jules-based approach achieves the same goal — iterative Conductor prompt
improvement — with zero infrastructure overhead.

---

## One-time setup

### 1. Required secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Required | Notes |
|---|---|---|
| `JULES_API_KEY` | ✅ yes | Generate at [jules.google.com](https://jules.google.com) → Account Settings. |
| `GITHUB_TOKEN` | auto | Provided by GH Actions; Jules uses it to create PRs. No manual setup. |

### 2. Trigger a manual smoke run

Before letting the nightly schedule kick in:

1. Go to **Actions → Nightly Jules Agent Optimization**
2. Click **Run workflow**
3. Watch the run complete. Expected outcomes:
   - Jules reads the Conductor and spoke prompts (~20 agent files)
   - If it finds routing gaps, a PR appears with targeted keyword additions
   - If everything looks clean, the run completes with no PR (valid outcome)

If the smoke run succeeds, leave the schedule enabled. If it fails, check
`JULES_API_KEY` validity first.

---

## Cost expectations

Jules API pricing applies. Each nightly run is a single Jules task invocation
that reads ~20 markdown files and produces at most a small diff. Expected
cost: **< $1 per run** (mostly prompt token ingestion).

No external LLM keys (OpenAI, Anthropic) are required — Jules uses Gemini
internally.

---

## What gets PR'd, and what doesn't

| Change kind | PR opened? |
|---|---|
| Jules found routing gaps and edited the routing table | ✅ yes |
| Jules found no improvements | ❌ no — empty diff, clean exit |
| Jules errored (bad API key, rate limit) | ❌ no — workflow fails loudly |

---

## Reviewing a nightly PR

Each Jules PR includes a diff. Pay attention to:

1. **Specialist IDs.** Every `targetAgentId` in the routing table must match
   an existing directory under `agents/`. Valid IDs: `analytics`, `brand`,
   `creative`, `distribution`, `event-planner`, `finance`, `hospitality`,
   `indii_curriculum`, `legal`, `licensing`, `marketing`, `merchandise`,
   `music`, `publicist`, `publishing`, `road`, `social`, `video`.
2. **Keyword accuracy.** New routing keywords should genuinely belong to the
   specialist they're mapped to. Cross-check against the specialist's `IN SCOPE`
   section.
3. **No structural changes.** Jules is instructed to only edit the ROUTING TABLE.
   If it touched MISSION, OPERATING MODES, ARCHITECTURE, or FAILURE BEHAVIOR,
   close the PR.
4. **Minimality.** Good PRs add a few missing keywords. Bad PRs rewrite prose.

---

## Disabling the workflow

If something goes wrong:

1. Revoke `JULES_API_KEY` at [jules.google.com](https://jules.google.com) (instant kill)
2. Or comment out the `schedule:` block in `.github/workflows/jules-autoagent.yml`
3. Or delete the workflow file entirely

---

## Known limitations

1. **No eval benchmark.** Unlike the original `kevinrgu/autoagent` plan, there
   is no scored benchmark. Jules uses its own judgment to identify routing gaps.
   This is a qualitative audit, not a quantitative hill-climb.
2. **No per-tenant prompts.** The Conductor has one global prompt. Jules
   optimizes the global routing table only.
3. **Single daily run.** Jules processes the full agent tree once per night.
   There is no iteration loop or multi-pass optimization.
4. **Human gate.** Every change requires manual PR review and merge. This is
   intentional — autonomous prompt modification in production is not allowed.