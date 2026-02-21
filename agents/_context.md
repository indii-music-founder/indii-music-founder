# indiiOS — Global Agent Context

## Project

- **App:** indiiOS Alpha (multi-tenant AI creative platform for independent artists)
- **Stack:** React 18 + Vite + Electron | Firebase | Gemini 3 | Zustand
- **Dev Server:** `http://localhost:4242` (Vite) | `http://localhost:3000` (Landing)
- **Repo:** `the-walking-agency-det/indiiOS-Alpha-Electron`
- **Firebase Project:** `indiios-v-1-1`

---

## Available Skills (Agent Playbook)

All skills are in `.agent/skills/<name>/SKILL.md`. Read the SKILL.md before executing.

| Skill | Invoke | Purpose |
|-------|--------|---------|
| `@opp.md` | `/opp` | **Start here.** Session bootstrap — full environment audit, reads active task + plan, prints Operator Status |
| `@go.md` | `/go` | Recursive execution loop — reviews progress, drives tasks to completion, runs Gauntlet verification |
| `@hunter.md` | `/hunter` | HTTP error code sweep — 401, 403, 404, 410, 413, 422, 429, 500, 502, 503, 504 across full stack |
| `@test.md` | `/test` | Smart test runner — maps modified files to correct test suite (Vitest/Playwright/pytest) |
| `@auto_qa.md` | `/auto_qa` | Autonomous visual QA — browser-based UI validation, writes results to AGENT_BRIDGE.md |
| `@better_agents.md` | `/better_agents` | Scaffold new specialist agents using LangWatch Better Agents CLI |
| `@brand_kit.md` | `/brand_kit` | Brand Kit + Onboarding system reference — AI-driven artist identity collection |
| `@live_test_creative_director.md` | `/live_test_creative_director` | Stress-test image generation pipeline end-to-end at localhost:4242 |

---

## Execution Rules

1. **Always run `/opp` at session start** to get situational awareness before any directive
2. **Check `.agent/skills/error_memory/ERROR_LEDGER.md`** before debugging any error
3. **Use `/go` for multi-step tasks** — it prevents getting lost in long sessions
4. **Use `/hunter` after any infrastructure change** — security rules, Cloud Functions, API clients
5. **Model policy:** Only use `gemini-3-pro-preview` (complex) or `gemini-3-flash-preview` (fast). Never use 1.5/2.0 variants.

---

## Key Files

| File | Purpose |
|------|---------|
| `.agent/artifacts/task.md` | Active task checklist |
| `.agent/artifacts/implementation_plan.md` | Active implementation plan |
| `AGENT_BRIDGE.md` | IPC bridge between Antigravity and OpenClaw |
| `firestore.rules` | Firestore security — update whenever collections change |
| `storage.rules` | Storage security — update whenever storage paths change |
| `src/core/config/ai-models.ts` | AI model constants — always import from here |
