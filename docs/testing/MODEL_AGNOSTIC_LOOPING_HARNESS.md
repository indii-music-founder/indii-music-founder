# Model-Agnostic Looping Harness Audit

Date: 2026-06-22

## Question

Can the testing system be built so a cheaper or less advanced model can succeed as well as, or sometimes better than, a stronger model by using a structured loop, feedback, and deterministic reinforcement?

## Current State

The repo already has the right primitives, but they are not fully wired into one model-agnostic evaluation lane.

Existing pieces:

- `packages/shared/src/schemas/agentLoopState.ts` defines loop goals, judge mode, max iterations, feedback, and execution history.
- `packages/renderer/src/services/agent/orchestration/AgentLoopService.ts` runs a `Goal -> Action -> Evaluate -> Feedback -> Retry` loop.
- `packages/renderer/src/services/agent/ReflectionLoop.ts` provides a quality-critic loop with capped retries.
- `scripts/agent-stress-test.mjs` runs live prompt stress tests against real agent prompt files and now supports model ladders plus feedback-loop retries.
- `docs/agent-training/SCORECARD.md` defines the prompt quality dimensions used for training audits.

Main gaps before this audit:

- The live stress runner used one hardcoded model.
- The runner graded only final one-shot responses, so it could not measure recovery from weak first attempts.
- `AgentLoopService` action execution is fixed to the generalist agent and does not expose a model matrix.
- `DETERMINISTIC_TEST` mode in `AgentLoopService` is currently a placeholder that always passes.
- LLM judge mode uses the fast model as judge, so cross-model evaluation still needs a stable deterministic judge lane for production-grade comparisons.

## Harness Contract

A fair weak-vs-strong model test should measure the harness, not just the model.

Required signals:

- `firstAttemptScore`: raw model performance before reinforcement.
- `finalScore`: result after bounded feedback loops.
- `attempts`: how many iterations were needed.
- `recovered`: whether a failed first attempt became a passing final attempt.
- `model`: exact model ID used for the action attempt.
- `cost` and `latency`: model quality must be compared against runtime cost.
- `judgeMode`: deterministic tests should be preferred for score-critical lanes.

Success means a lower-tier model can meet the same deterministic acceptance criteria within bounded attempts and lower total cost. It does not mean the lower-tier model is intrinsically smarter.

## New Runner Usage

Single model, legacy behavior:

```bash
node scripts/agent-stress-test.mjs --agent finance --quick
```

Compare approved Gemini tiers:

```bash
node scripts/agent-stress-test.mjs --agent finance --quick --model-ladder
```

Run a feedback loop so weaker models can recover:

```bash
node scripts/agent-stress-test.mjs --agent finance --quick --model-ladder --loop=3
```

Custom model list:

```bash
node scripts/agent-stress-test.mjs --models=gemini-3.1-flash-lite,gemini-3.1-pro-preview --loop=3
```

## Recommended Next Build

1. Promote the stress-runner rubric into a shared evaluator module so `AgentLoopService`, training reports, and CLI stress tests use the same scoring contract.
2. Replace `DETERMINISTIC_TEST` placeholder behavior with actual evaluator adapters: regex checks, JSON schema checks, Playwright result checks, and cost/latency thresholds.
3. Add a provider-neutral model descriptor shape: `{ provider, model, effort, costTier, capability }` so OpenAI/Claude/Gemini ladders can be compared by role without hardcoding provider-specific assumptions into tests.
4. Add a CI-safe non-live fixture test for the runner's reinforcement logic, then keep live model-ladder runs as opt-in because they spend tokens.
5. Gate training claims on `finalScore`, `attempts`, `recovered`, and `cost`, not just pass rate.

## Bottom Line

The architecture should not ask, "Which model is smartest?" It should ask, "Which model plus harness satisfies the acceptance criteria with the best reliability, cost, and latency?" That is how a mini/flash/haiku tier can legitimately beat a pro/opus/high-effort tier for production tasks.
