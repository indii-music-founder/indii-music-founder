# Hierarchical Agent System — Multi-Harness Handoff

> **Visible to all agent harnesses** (Claude, Gemini, Codex, Droid, Jules).
> If you are picking up this work mid-stream, read this document first.
> Do not duplicate completed work. Continue from the next unchecked task.

**Branch:** `feat/hierarchical-agent-modes` (NOT main)
**Plan:** `/Volumes/X SSD 2025/Users/narrowchannel/.claude/plans/https-www-philschmid-de-subagent-pattern-elegant-thompson.md`
**Started:** 2026-05-06
**Status:** Phase 1 (Foundation) shipped. Phase 2 (Wiring) pending.

---

## What This Project Is

The user envisions three conversation modes layered on top of the existing
`Boardroom + Living Files + Living Plans` Pattern 4 stack:

| Mode | Who's in the conversation | Cross-dept allowed? |
|------|---------------------------|---------------------|
| **Direct** | User ↔ one agent (head or worker) | N/A — single agent |
| **Department** | User ↔ head; head ↔ own workers | **No** |
| **Boardroom** | User ↔ seated heads; heads ↔ each other | **Yes**, between heads only |

Workers never appear in Boardroom. Heads never delegate cross-department in Department mode. Direct mode does no delegation at all.

The two-tier hierarchy uses the existing `BaseAgent.AgentCategory` type
(`'manager' | 'department' | 'specialist'`) — `department` = head, `specialist` = worker.

A2A network transport stays dormant (sidecar was correctly removed when agent-zero was retired). All work is in-process.

---

## Phase 1 — Foundation ✅ DONE

These changes are in this branch and are additive/safe:

- [x] `packages/renderer/src/services/agent/departments.ts` — NEW. Registry of 21 departments, one per existing specialist agent. Zero workers in Phase 1; population is incremental in Phase 3.
- [x] `packages/renderer/src/services/agent/a2a/AgentCard.schema.ts` — added optional `roster` field (`category`, `departmentId`, `workerIds`). AgentCards are now Living Cards. Existing cards still validate (field is optional).
- [x] `packages/renderer/src/core/store/slices/agent/agentUISlice.ts` — added `conversationMode`, `activeDepartmentId`, `directTargetAgentId` + setters. Default mode `'boardroom'` preserves current behavior.
- [x] `packages/renderer/src/services/agent/BaseAgent.ts` — `delegate_task` and `consult_experts` now enforce three new violations: `DIRECT_MODE_NO_DELEGATION`, `DEPARTMENT_SCOPE_VIOLATION`, `BOARDROOM_TIER_VIOLATION`. Existing `BOARDROOM_SEATING_VIOLATION` preserved.
- [x] `packages/renderer/src/services/agent/__tests__/scopeEnforcement.test.ts` — NEW. Unit tests for the registry helpers (`isHead`, `isWorker`, `sameDepartment`, etc.) that drive the enforcement logic.
- [x] `.agent/skills/error_memory/ERROR_LEDGER.md` — entry added for the three new error codes so future debugging recognizes them as expected governance rejections.

### How the new violations fire

In `BaseAgent.delegate_task` and `BaseAgent.consult_experts`, before any other logic:

```ts
const mode = ctx.conversationMode;
if (mode === 'direct')         → DIRECT_MODE_NO_DELEGATION
if (mode === 'department' && !sameDepartment(self, target)) → DEPARTMENT_SCOPE_VIOLATION
if (mode === 'boardroom' && !isHead(target))                → BOARDROOM_TIER_VIOLATION
// existing BOARDROOM_SEATING_VIOLATION still applies
```

Phase 1 ships infrastructure only — `conversationMode` is set but no caller yet sets it on the AgentContext. Phase 2 wires that up.

---

## Phase 2 — Wiring ✅ DONE

Goal: make the three modes user-selectable from desktop, propagate `conversationMode` into `AgentContext`, and add the routing dispatch in `AgentService.sendMessage`.

### Tasks

- [x] Build `packages/renderer/src/components/AgentModePicker.tsx` — three-segment switch (Direct / Department / Boardroom) plus contextual selector:
  - Direct: agent dropdown grouped by department (use `DEPARTMENTS` from `departments.ts`)
  - Department: department dropdown
  - Boardroom: opens existing Boardroom module (no extra selector)
  Reads/writes `conversationMode`, `activeDepartmentId`, `directTargetAgentId` from `agentUISlice`.

- [x] Mount the picker in the desktop CommandBar or sidebar. Reference for styling: existing `packages/renderer/src/modules/mobile-remote/components/AgentChat.tsx` (mobile already has an agent picker — refactor it to use the shared component for parity).

- [x] Add `handleDepartmentFlow` method to `packages/renderer/src/services/agent/AgentService.ts`. Mirrors `handleDirectChatFlow`:
  ```ts
  case 'department': {
    const dept = DEPARTMENTS[state.activeDepartmentId!];
    return this.handleDepartmentFlow(dept, text, attachments, ctx, responseId);
  }
  ```
  Inside: force `forcedAgentId = dept.headId`, set `ctx.conversationMode = 'department'`, then run the head agent. The head's existing `delegate_task` calls will now be scope-checked by `sameDepartment`.

- [x] Update `AgentService.sendMessage` (~line 336) to dispatch on `conversationMode`:
  ```ts
  switch (state.conversationMode) {
    case 'direct':     return this.handleDirectChatFlow(...);
    case 'department': return this.handleDepartmentFlow(...);
    case 'boardroom':  // existing path (executeBoardroomSwarm or normal hub flow)
  }
  ```

- [x] Verify `AgentContext` carries `conversationMode` through the runner (`context.runAgent` → child agent must see the mode). Inspect `ExecutionContextFactory` and `ToolExecutionContext` to confirm.

- [x] Manual QA all three modes via Electron dev:
  - Direct: pick Finance, ask "have legal review" → trace shows zero delegation, response stays in Finance, console logs `DIRECT_MODE_NO_DELEGATION` if attempted.
  - Department: pick Finance dept, ask multi-step task → only finance head responds today (no workers yet); attempt cross-dept in test → `DEPARTMENT_SCOPE_VIOLATION`.
  - Boardroom: existing behavior unchanged unless you test seating a worker (Phase 3).

---

## Phase 3 — Workers (incremental, per department) ✅ DONE

Pick one department to seed first. Recommended: Finance.

- [x] Define worker `RAGAgent` configs (in `agentConfig.ts` or new `agents/finance/workers/*.config.ts`).
- [x] Worker IDs use dot notation: `finance.tax`, `finance.royalty`, etc.
- [x] Register in `AgentRegistry`. Add to `VALID_AGENT_IDS` in `packages/renderer/src/services/agent/types.ts`.
- [x] Add `roster.category = 'specialist'` and `roster.departmentId = 'finance'` to the worker's AgentCard.
- [x] Update `DEPARTMENTS.finance.workerIds` in `departments.ts` to include them.
- [x] Update `finance.card.ts` head card with `roster.workerIds = ['finance.tax', 'finance.royalty']`.
- [x] Verify Department mode fan-out works: head should call `delegate_task('finance.tax', ...)` without scope violation.
- [x] Repeat for Legal, Distribution, Marketing, Brand as needed.

---

## Phase 4 — Polish (optional)

- [x] Boardroom UI sub-orbit: clicking a seated head reveals their workers as a read-only inner orbit (`packages/renderer/src/modules/boardroom/components/BoardroomTable.tsx`).
- [x] Living Plans tracker shows worker steps under their head's plan node.
- [x] Populate the 21 head AgentCards with real `capabilities[]` arrays (currently empty stubs). Source: each agent's `AgentConfig.tools` + system prompt.

---

## Critical Files (cheat sheet)

| Purpose | Path |
|---|---|
| Department registry (source of truth) | `packages/renderer/src/services/agent/departments.ts` |
| Conversation mode state | `packages/renderer/src/core/store/slices/agent/agentUISlice.ts` |
| Scope enforcement | `packages/renderer/src/services/agent/BaseAgent.ts` (delegate_task ~L137, consult_experts ~L193) |
| AgentCard / Living Card schema | `packages/renderer/src/services/agent/a2a/AgentCard.schema.ts` |
| Per-agent cards | `packages/renderer/src/services/agent/a2a/cards/*.card.ts` |
| Tests | `packages/renderer/src/services/agent/__tests__/scopeEnforcement.test.ts` |
| Routing dispatch (Phase 2 work) | `packages/renderer/src/services/agent/AgentService.ts` (~L336) |
| Mobile reference UI | `packages/renderer/src/modules/mobile-remote/components/AgentChat.tsx` |
| Error registry | `.agent/skills/error_memory/ERROR_LEDGER.md` |

---

## Verification

Before merging this branch:

```bash
npm run typecheck
npm test -- --run packages/renderer/src/services/agent/__tests__/scopeEnforcement.test.ts
npm test -- --run   # full suite, no regressions
```

Per CLAUDE.md, run `/plat` before pushing. Open a PR; do not push to main directly.

---

## Out of Scope (do not start)

- A2A network transport / sidecar revival — explicitly dormant (agent-zero was deliberately retired, `docker-compose.yml` correctly removed).
- Genkit flow definitions — the dependency is installed but unused; address as a separate cleanup task.
- Reconciling stale references in CLAUDE.md / GEMINI.md / DROID.md / JULES.md / CODEX.md to the old sidecar / Python tools — separate doc-pass.

---

## Risk & Reversibility

- New `conversationMode` defaults to `'boardroom'` (preserves current behavior). No user-visible change until Phase 2 ships the picker.
- Enforcement is additive — disabling the new checks reverts to current behavior.
- AgentCard `roster` field is optional — existing cards still validate.
- Worker agents are opt-in per department (Phase 3). Empty `workerIds` arrays = no behavioral change.

---

## Contact / Notes

If you find the in-flight work has rotted or context is lost, the canonical reference is the plan file at `~/.claude/plans/https-www-philschmid-de-subagent-pattern-elegant-thompson.md`. The Schmid article that inspired this is at https://www.philschmid.de/subagent-patterns-2026 — but the conclusion is that indiiOS already implements all four patterns in-process; this work adds the *scoping* (tier + department membership) that the existing flat seating model lacks.
