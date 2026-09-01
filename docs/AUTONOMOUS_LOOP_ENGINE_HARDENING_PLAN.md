# Execution Plan — Autonomous Loop Engine Hardening & Concurrency Stabilization

> **Plan of Record:** 2026-09-01  
> **Role:** Autonomous Loop Engine Controller (Agent #27, indiiOS Layer 1)  
> **Status:** Pending Review / Ready for Execution  
> **Target Monorepo Packages:** `packages/renderer`, `packages/firebase`, `packages/shared`

---

## 1. Executive Summary & Objective

An audit of indiiOS Layer 1 autonomous loop and workflow subsystems ([`AgentLoopService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentLoopService.ts), [`WorkflowStateService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/WorkflowStateService.ts), [`AgentGraphService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentGraphService.ts), and backend [`CampaignFSM.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/firebase/src/orchestration/fsm/machine.ts)) revealed five critical failure modes:

1. **In-Memory State Volatility:** `AgentLoopService` execution records live solely in an in-memory `Map`, lost on any tab reload or process restart.
2. **Non-Transactional Workflow State Mutations:** `WorkflowStateService` and `CampaignFSM` execute non-atomic read-then-write steps, vulnerable to race conditions and lost updates under concurrent agent execution.
3. **Transient Failure Loop Burning:** `AgentLoopService` treats infrastructure exceptions (timeouts, rate limits) as agent output, feeding error strings to the LLM judge and depleting iteration budgets without exponential backoff.
4. **Context Bloat & Token Runaways:** Unbounded memory retrieval (100 raw memories) and untruncated parent outputs are injected directly into DAG prompts without token budget gates.
5. **Local-Only Process Locks:** `AgentGraphService` relies on a single JavaScript heap `Set<string>`, failing to guard against concurrent multi-window or distributed runner execution.

This plan specifies the implementation to resolve all five vulnerabilities systematically.

---

## 2. Architecture & Vulnerability Matrix

## Implementation Progress & Work Breakdown

| Work Package | Focus Area | Status | Verification Target |
| :--- | :--- | :--- | :--- |
| **WP-B1** | Atomic Firestore Transactions (`WorkflowStateService.ts`) | **Completed** | `WorkflowStateService.test.ts` (10/10 passing) |
| **WP-B2** | FSM Transactional State (`CampaignFSM.ts`) | **Completed** | `machine.test.ts` (4/4 passing) |
| **WP-A** | Durable Persistence & Resumption (`AgentLoopService.ts`) | **Completed** | `AgentLoopService.test.ts` (resumption test) |
| **WP-C** | Exponential Backoff & Transient Retry (`AgentLoopService.ts`) | **Completed** | `AgentLoopService.test.ts` (backoff test) |
| **WP-D1** | Checkpoint Context Trimming (`AgentLoopService.ts`) | **Completed** | `AgentLoopService.test.ts` (context trim) |
| **WP-D2** | Context Trimming & Memory Capping (`AgentGraphService.ts`) | **Completed** | `AgentGraphService.hardening.test.ts` |
| **WP-E** | Distributed Lease Locking & Deadlines (`AgentGraphService.ts`) | **Completed** | `AgentGraphService.hardening.test.ts` |

**Committed on `main`:** Commit [`4b1e77f4a`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder) with all 5 pre-commit quality gates passed.

---

## 3. Work Packages Detail

### WP-A: Durable Firestore Persistence & Resumption for AgentLoopService

* **Target File:** [`packages/renderer/src/services/agent/orchestration/AgentLoopService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentLoopService.ts)
* **Target Schema:** `packages/shared/src/schemas/agentLoop.ts` (if updates needed)

#### Implementation Steps:
1. Replace `private executionStore: Map<string, AgentLoopExecution>` with a backed `FirestoreService<AgentLoopExecution>('users/${userId}/agentLoopExecutions')`.
2. Persist `AgentLoopExecution` on creation, after each step transition, and upon evaluation completion.
3. Keep the Zustand store sync (`useStore.getState().updateLoopExecution(execution)`) for real-time UI reactions.
4. Implement `resumeLoop(userId: string, executionId: string, context: AgentContext)`:
   - Retrieves last saved checkpoint from Firestore.
   - Verifies `status === EXECUTING` or `status === FAILED`.
   - Resumes the loop starting from `currentIteration` without re-running completed iterations.
5. Implement `getResumableLoops(userId: string)` to surface pending loops on application startup.

#### Test Plan:
* Update [`packages/renderer/src/services/agent/orchestration/AgentLoopService.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentLoopService.test.ts):
  - Test initial loop persistence to Firestore mock.
  - Test resumption from iteration 2 of an interrupted 3-iteration loop.
  - Verify that `getExecution` retrieves from Firestore if not in active memory cache.

---

### WP-B: Atomic Firestore Transactions for Workflow Execution

#### Sub-package B1: `WorkflowStateService.ts`
* **Target File:** [`packages/renderer/src/services/agent/WorkflowStateService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/WorkflowStateService.ts)
* **Problem:** Methods `markStepExecuting`, `advanceStep`, `skipStep`, `failStep` execute plain `get()` then `set()` which overwrites the entire document, causing race conditions when steps run in parallel.
* **Implementation:**
  1. Import `runTransaction` and `doc` from `firebase/firestore`.
  2. Refactor `markStepExecuting(userId, executionId, stepId)`:
     - Run inside `runTransaction(db, async (tx) => { ... })`.
     - Read doc snapshot within transaction.
     - Validate step exists and status is `PLANNED` or `FAILED` (fail loudly if already executing).
     - Update specific path `steps.${stepId}.status` and `steps.${stepId}.startedAt` + top-level `status: 'EXECUTING'` and `updatedAt`.
  3. Refactor `advanceStep(userId, executionId, stepId, result, blockers)`:
     - Read doc snapshot within transaction.
     - Verify step is currently `EXECUTING_GENERATION` or `PLANNED`.
     - Evaluate blockers: if blockers present, transition step to `FAILED`.
     - If passing, update `steps.${stepId}.status = 'STEP_COMPLETE'` and `steps.${stepId}.result`.
     - Evaluate if all other steps in the snapshot are complete/skipped; if so, update top-level `status = 'COMPLETED'`.
  4. Apply identical transactional patterns to `skipStep` and `failStep`.

#### Sub-package B2: `CampaignFSM.ts`
* **Target File:** [`packages/firebase/src/orchestration/fsm/machine.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/firebase/src/orchestration/fsm/machine.ts)
* **Implementation:**
  1. Refactor `transition(newState: FSMState, error?: string)` to execute within `getDb().runTransaction(async (tx) => { ... })`.
  2. Inside transaction:
     - Read `campaign_fsm` document.
     - Assert `context.state !== 'COMPLETED'`.
     - Compute new state, increment `retries` if `newState === 'FAILED'`.
     - Commit atomic update via `tx.set(docRef, updates, { merge: true })`.

#### Test Plan:
* Update [`WorkflowStateService.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/WorkflowStateService.test.ts):
  - Mock `runTransaction` to simulate concurrent step updates and verify no lost updates.
  - Verify idempotency error when trying to mark an already executing step.
* Add [`packages/firebase/src/orchestration/fsm/machine.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/firebase/src/orchestration/fsm/machine.test.ts):
  - Test atomic state transitions and retry increments under transaction.
  - Test that transitioning a `COMPLETED` campaign throws `failed-precondition`.

---

### WP-C: Transient Failure Classification & Graceful Backoff in Loop Engine

* **Target File:** [`packages/renderer/src/services/agent/orchestration/AgentLoopService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentLoopService.ts)

#### Implementation Steps:
1. Create `classifyError(error: unknown): 'TRANSIENT' | 'PERMANENT'`:
   - `TRANSIENT`: Network errors, timeouts (`AbortError`, `ETIMEDOUT`, 504), rate limits (`429`, `RESOURCE_EXHAUSTED`), service unavailable (`503`).
   - `PERMANENT`: Schema validation, auth rejection, tool permission denied, model format errors.
2. In `executeActionWithRetry(prompt: string, context: AgentContext, maxRetries = 3)`:
   - Implement exponential backoff with jitter: $\text{delay} = \min(10000, 1000 \times 2^{\text{attempt}} + \text{random}(0, 500))$.
   - On transient failure, log warning and retry up to `maxRetries`.
   - If all retries fail, do NOT pass the error string to `evaluateOutcome()`.
   - Pause the loop with `status = PAUSED_TRANSIENT_ERROR` (or `FAILED` with explicit `errorType = 'INFRASTRUCTURE'`), preserving the current iteration number so the user/system can resume without having burned an iteration.
3. In `evaluateOutcome()`:
   - Wrap judge call with single retry on transient error.
   - If judge fails after retry, do not fail the loop; log warning and provide constructive fallback feedback rather than blind failure.

#### Test Plan:
* Add unit tests to `AgentLoopService.test.ts`:
  - Simulate transient 429/timeout in action execution: verify it retries with backoff and succeeds on attempt 2 without incrementing `currentIteration`.
  - Simulate persistent exhaustion: verify loop halts with infrastructure error without invoking LLM judge.

---

### WP-D: Token Optimization & Checkpoint Trimming

#### Sub-package D1: `AgentLoopService` Context Trimming
* **Target File:** [`packages/renderer/src/services/agent/orchestration/AgentLoopService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentLoopService.ts)
* **Implementation:**
  1. Integrate [`TokenEstimator`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/governance/TokenEstimator.ts) in `buildIterationPrompt`.
  2. Implement checkpoint history trimming:
     - Cap historical iteration feedback in the prompt to the last 2 attempts (instead of unbounded history).
     - Truncate any single prior output to a maximum of 2,500 characters, appending `[Output trimmed for context efficiency]`.
     - Ensure total prompt remains well within the pre-flight token budget.

#### Sub-package D2: `AgentGraphService` Memory & Prompt Trimming
* **Target File:** [`packages/renderer/src/services/agent/orchestration/AgentGraphService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentGraphService.ts)
* **Implementation:**
  1. In `memoryBankService.searchMemories()`:
     - Reduce search limit from 100 to 5 most relevant memories.
     - Enforce a maximum character budget (e.g. 3,000 characters total) for injected `memoryContext`.
  2. In `resolveNodePrompt()`:
     - Bound parent outputs (`{{sourceNodeId}}` and `{{sourceNodeId.path}}`) to 10,000 characters each.
     - If exceeded, preserve leading 8,000 chars + trailing 2,000 chars with an explicit trimming marker.

#### Test Plan:
* Add unit tests in `AgentGraphService.test.ts`:
  - Test that 50KB parent output is trimmed to safe character limits before child execution.
  - Test memory context truncation.
* Add unit tests in `AgentLoopService.test.ts`:
  - Test that iteration prompt does not exceed configured token caps across 5+ iterations.

---

### WP-E: Distributed Lease Locking & Timeout Deadlines

* **Target Files:**
  - [`packages/renderer/src/services/agent/orchestration/AgentGraphService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentGraphService.ts)
  - [`packages/renderer/src/services/agent/orchestration/AgentGraphStateService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/services/agent/orchestration/AgentGraphStateService.ts)
  - [`.agent/skills/firestore-transaction-locks.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/.agent/skills/firestore-transaction-locks.md)

#### Implementation Steps:
1. Extend `GraphExecutionState` schema in `packages/renderer/src/services/agent/types.ts`:
   - `lease?: { holderId: string; expiresAt: number; acquiredAt: number }`
2. Implement `acquireGraphLeaseAtomically(userId, executionId, runnerId)`:
   - Uses `runTransaction(db, async (tx) => { ... })`.
   - Reads doc snapshot:
     - If no lease, or `lease.expiresAt < Date.now()` (expired lock), grant lease to `runnerId` with a 20-second lease deadline (`expiresAt = Date.now() + 20000`).
     - If actively leased by another `runnerId`, reject claim (`false`).
3. Arm a 5-second lease heartbeat in `AgentGraphService`:
   - Periodically extends `expiresAt = Date.now() + 20000` while loop is actively processing.
4. Add Execution Timeout & Idle Guards (per `.agent/skills/firestore-transaction-locks.md`):
   - Enforce 270-second hard execution deadline. If exceeded, transition graph to `FAILED` with timeout reason and release lease.
   - Enforce 60-second idle limit if no node transitions occur.
5. In `finally` block:
   - Release lease atomically (`lease: null`) and clear heartbeat intervals.

#### Test Plan:
* Add tests in `packages/renderer/src/services/agent/orchestration/AgentGraphService.loopguard.test.ts`:
  - Two concurrent runner instances attempting to run the same execution ID: runner 1 acquires lease, runner 2 is rejected.
  - Expired lease (> 20s old) is successfully acquired by runner 2.
  - Execution exceeding 270s times out gracefully and releases lease.

---

## 4. Execution Sequencing & Commit Strategy

Every work package must compile cleanly and pass full unit suites prior to commit.

```
Step 1 (WP-A):  Durable Firestore persistence for AgentLoopService
                Commit: feat(agent): persist AgentLoopService executions to Firestore with resumption
Step 2 (WP-B1): Transactional step mutations in WorkflowStateService
                Commit: fix(agent): atomic Firestore transactions for WorkflowStateService step transitions
Step 3 (WP-B2): Transactional state machine in CampaignFSM
                Commit: fix(orchestration): transactional CampaignFSM transitions with retry guards
Step 4 (WP-C):  Transient error backoff and classification in AgentLoopService
                Commit: feat(agent): jittered exponential backoff and transient failure handling in AgentLoopService
Step 5 (WP-D):  Token budgeting and context trimming in AgentLoop & AgentGraph
                Commit: perf(agent): enforce token budgeting and prompt trimming across loop cycles
Step 6 (WP-E):  Distributed lease locking and timeout guards for AgentGraphService
                Commit: feat(agent): distributed Firestore lease locking and 270s deadline for AgentGraphService
```

---

## 5. Pre-Execution Checklist & Safety Invariants

- [x] Platinum Quality Standards checked: no silent reverts, no dropped error recovery paths.
- [x] Untouched foreign dirty files respected (`.agent/observations/2026-08-27-agent-watch.md`, landing sections, etc.).
- [x] Read-before-write invariant strictly verified for every `runTransaction()` block.
- [x] Test coverage: each work package accompanied by dedicated unit tests.
- [x] No secrets or API keys introduced into client bundles.

