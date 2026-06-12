# Agent Elevation Checklist

> Per-folder pipeline for elevating an in-app specialist agent (`agents/<name>/`).
> Piloted on `agents/analytics/` (2026-06-11). Execute phases in order; one atomic
> commit per agent folder. Any swarm agent (Claude, Gemini, Jules, Codex, DROID,
> Antigravity) can pick up a folder and follow this verbatim.

## Ground truth (read first)

- `agents/<name>/prompt.md` is **live production code** — imported raw as the
  system prompt via `import systemPrompt from '@agents/<name>/prompt.md?raw'`
  in `packages/renderer/src/services/agent/definitions/<Name>Agent.ts`.
- `agents/<name>/agent_card.json` is **runtime-loaded** via
  `packages/renderer/src/services/agent/a2a/CardRegistry.ts` and validated in CI by
  `CardRegistry.test.ts` against `AgentCard.schema.ts`.
- `agents/capability_registry.json` is **generated** — never hand-edit. Regenerate:
  ```bash
  python3 agents/foundational/audit_skill/tools/scan_directory.py \
    --root "$(pwd)/agents" --output agents/capability_registry.json
  ```
- Fine-tune routing lives in
  `packages/renderer/src/services/agent/fine-tuned-models.ts`; training datasets in
  `docs/agent-training/datasets/`.

## Phase A — Card (`agent_card.json`)

- [ ] Every `capabilities[].name` corresponds to a real tool in the agent's TS
      definition (`definitions/<Name>Agent.ts` → `functions` / `authorizedTools`).
- [ ] Every capability description is **truthful about mechanism** — if a tool is a
      heuristic or a projection, the description must say so. Never describe a
      rubric as a data-trained prediction. (Pilot example: viral score is labeled
      "heuristic estimate only — not a prediction from historical streaming data".)
- [ ] `riskTier` is honest: `read` (analytics/reporting), `write` (creates/updates
      user data), `destructive` (irreversible operations).
- [ ] `costModel` has real per-token rates (match the model in `fine-tuned-models.ts`).
- [ ] `promptVersion` (`<app-version>-<agent>`) and `trainingModel` are set.
- [ ] `roster` declares category + departmentId per the hub-and-spoke hierarchy.
- [ ] Card passes: `npx vitest run packages/renderer/src/services/agent/a2a/CardRegistry.test.ts`

## Phase B — Prompt (`prompt.md`)

- [ ] **Verify every factual claim** against the codebase: named tools exist in the
      TS definition; named collaborators exist in the registry; named data sources
      (BigQuery tables, Firestore collections) exist in `packages/firebase/`.
- [ ] Collaboration roster lists only real registered agents.
- [ ] Has: mission, capabilities, tool-usage rules, constraints, failure behavior
      (what to do when a tool errors/times out), and a structured output format.
- [ ] NO-MOCK-DATA covenant: prompt instructs the agent to label estimates,
      projections, and heuristics as such; never present them as measured facts.
- [ ] No ritual cruft ("SWARM VERIFICATION" footers, status stamps) and no
      AI-hype buzzwords.
- [ ] Bump `promptVersion` in the card when the prompt changes materially.

## Phase C — Skills

- [ ] **Delete mock/simulated tools** (anything using `random`, hardcoded fake
      results, or fabricated entities). Honest empty states beat fake data.
- [ ] Real skills live as TS tools (`packages/renderer/src/services/agent/tools/`)
      fed by real data (Firestore/BigQuery/Cloud Functions), or as deterministic
      `execution/` scripts (Layer 3). Reuse existing tools before writing new ones
      (pilot reused `detect_streaming_anomalies` + `run_cohort_analysis`).
- [ ] Remove orphaned `skills/tools/description.txt` files whose implementation was
      deleted — the registry generator reads them and would resurrect stale entries.
- [ ] Gap analysis: list 2–3 skills that would make this specialist genuinely
      valuable; implement what's feasible now, file the rest as GitHub issues
      (`triage/ready-for-agent`).

## Phase D — Wiring (only if the agent has no TS definition)

- [ ] Create `packages/renderer/src/services/agent/definitions/<Name>Agent.ts`
      copying the `MusicAgent.ts` / `AnalyticsAgent.ts` pattern: `?raw` prompt
      import, `get functions()`, `authorizedTools`, `functionDeclarations`,
      `freezeAgentConfig`.
- [ ] Replace any inline stub registration in `registry.ts` with the lazy-loaded
      real definition.
- [ ] Tool declarations in the definition match the card's capabilities 1:1.

## Phase E — Verify & land

- [ ] Regenerate `agents/capability_registry.json` (command above) — idempotent;
      diff should only show this agent + timestamp.
- [ ] `npm run typecheck` — 0 errors.
- [ ] Targeted tests: `npx vitest run packages/renderer/src/services/agent/a2a/CardRegistry.test.ts`
      plus any tests for touched tools/definitions.
- [ ] Grep proof: no `random.`, `MOCK`, `placeholder` remnants in this agent's
      skills or tools.
- [ ] One conventional commit per folder; push to the stage branch; PR per stage.

## Folder status

| Agent | A Card | B Prompt | C Skills | D Wiring | Notes |
|---|---|---|---|---|---|
| analytics | ✅ | ✅ | ✅ | ✅ | Pilot — completed 2026-06-11 (swarm + truthfulness pass) |
| brand | ✅ | — | — | n/a wired | |
| conductor | ✅ | — | — | n/a wired | Prompt shared by GeneralistAgent — extra review |
| creative | ✅ | — | — | n/a wired | |
| default | ✅ | — | — | metadata-only | |
| distribution | ✅ | — | — | n/a wired | |
| finance | ✅ | — | — | n/a wired | |
| foundational | n/a | n/a | — | n/a | Shared skill library (audit_skill, memory_skill), not an agent |
| generalist | — | — | — | borrows conductor prompt | Needs own prompt (5 lines today) |
| indii_curriculum | ✅ | — | — | specialist | |
| indii_executor | — | — | — | — | riskTier `destructive` — review carefully |
| legal | ✅ | — | — | n/a wired | |
| licensing | ✅ | — | — | n/a wired | |
| marketing | ✅ | — | — | n/a wired | |
| merchandise | ✅ | — | — | — | Card elevated; TS definition TBD |
| music | ✅ | — | — | n/a wired | |
| publicist | ✅ | — | — | n/a wired | |
| publishing | ✅ | — | — | n/a wired | |
| road | ✅ | — | — | n/a wired | |
| social | ✅ | — | — | n/a wired | |
| video | ✅ | — | — | n/a wired | |
