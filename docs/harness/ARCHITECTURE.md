# RightsOps Harness Architecture

The RightsOps harness is a binding, multi-layer governance system that prevents copyright registrations from proceeding against incomplete or unapproved rights data. It sits between the user intent ("submit to BMI") and the irreversible action (the filing).

## The Problem

Without the harness, a user could file incomplete data — missing writer IPIs, unconfirmed splits, or stale information — and the filing would succeed. Once filed, many registrations are immutable. The artist would be locked into incorrect data for months or years.

Registration mistakes are expensive:
- **Missing IPI:** Writer cannot be paid mechanical royalties.
- **Incorrect split:** Co-writers get the wrong percentage; resolution requires all parties re-sign.
- **Stale approval:** Splits changed after approval, but the filing went out against old data.
- **Unconfirmed claimant:** Publisher disputes arise; registration can be challenged.

The harness makes such mistakes impossible by enforcing readiness gates before any irreversible action.

## The Architecture

```
User clicks "Submit to BMI"
        ↓
[1. Readiness Compiler] (PublishingRightsCompiler)
    ├─ reads current state (splits, IPIs, registration status)
    ├─ emits blockers (missing IPI? splits ≠ 100%? claimant unverified?)
    ├─ emits approval gates (require explicit human sign-off)
    └─ emits findings & recommendations
        ↓
[2. Approval Gate Check]
    ├─ Is there a gate for 'file registration'?
    ├─ Has the user approved it?
    ├─ Is the approval FRESH (not stale)?
    └─ If any fail → HALT
        ↓
[3. Freshness Validation] (PassportHashService)
    ├─ Compute SHA-256 of current Song Passport (splits, claimant, IPIs)
    ├─ Compare against hash stored at approval time
    ├─ If hashes differ → approval is STALE (track changed)
    └─ If stale → require re-approval
        ↓
[4. Pause Gates] (RegistrationForm UX)
    ├─ Certification Review pause (user reviews form)
    ├─ Final Submission pause (user confirms binding action)
    └─ User explicitly confirms at each pause
        ↓
[5. Submission] (adapter.submit)
    └─ Only reached if ALL gates pass
```

## Core Concepts

### HarnessRun (The Decision Object)

A `HarnessRun` is the output of a readiness compiler. It contains:

- **scores** — Readiness metrics (split approval %, IPI coverage %, registration status)
- **blockers** — Critical blockers that prevent filing (splits don't sum to 100%, IPI missing)
- **approvalGates** — Explicit gates requiring user sign-off (approval, blocked, attorney_review, destructive)
- **findings** — Severity-assessed issues (info, low, medium, high, critical)
- **recommendations** — Actions to resolve findings (routed to specific agents)
- **agentBriefs** — Routing for unresolved issues across departments

The HarnessRun is the source of truth for readiness. If a HarnessRun says "not ready," the workflow halts. No agent or user can override it.

### Song Passport (Versioned Rights State)

A Song Passport is the authoritative state of a track's rights at a moment in time:

```json
{
  "title": "Midnight Dream",
  "copyrightClaimant": "Jane Artist",
  "publisherName": "Jane Music Publishing",
  "writers": [
    { "name": "Jane Artist", "role": "composer", "percentage": 60, "ipiNumber": "P-123..." },
    { "name": "John Producer", "role": "composer", "percentage": 40, "ipiNumber": "P-456..." }
  ],
  "iswc": "T-123456789-0"
}
```

When approval is granted, a SHA-256 hash of the Passport is stored:

```
passportHash = SHA256(canonical_json(passport))
approvalGrantedAt = 2026-06-30T10:18:00Z
```

If the user edits writers, splits, claimant, or IPI data *after* approval, the hash will differ. The approval becomes **STALE** and must be renewed.

This prevents the silent-drift failure mode: user approves, then forgets they changed the splits, and the filing goes out with outdated data.

### Approval Gates (Irreversible Actions)

An approval gate is a decision point that requires explicit user confirmation. Gates are scoped by `riskTier`:

- **approval** — Needs user sign-off, but can be undone via re-approval
- **blocked** — Gate is blocking; must be resolved before proceeding
- **attorney_review** — Requires a qualified attorney before proceeding
- **destructive** — Irreversible action; user must explicitly confirm they understand the consequences

Example:
```
Gate: file_registration
RiskTier: approval
Reason: "Copyright and mechanical rights registrations are binding legal actions."
```

### Workflow State Enforcement

The `WorkflowStateService` tracks discrete step-by-step execution of multi-step workflows. Each step has a status:

- **PLANNED** — Ready to start
- **EXECUTING** — Currently running
- **STEP_COMPLETE** — Finished successfully
- **FAILED** — Failed (can be retried)
- **SKIPPED** — Intentionally skipped
- **CANCELLED** — User cancelled the workflow

When a step tries to advance (`advanceStep()`), the system checks if readiness blockers exist. If they do, the step fails immediately rather than completing.

```typescript
// If blockers are provided, the step fails instead of completing
advanceStep(userId, executionId, stepId, result, blockers?: string[])
```

This prevents workflows from silently moving forward when checks fail.

## Design Decisions & Trade-Offs

### Decision 1: Multiple Layers Instead of a Single Gate

**Rationale:** A single approval gate is insufficient because:
- User approval (layer 2) doesn't catch incomplete data
- Freshness validation (layer 3) doesn't catch newly-created issues
- Workflow state (layer 5) doesn't prevent hasty clicks

Multiple layers catch different failure modes:
- Layer 1 (readiness) catches missing data
- Layer 3 (freshness) catches drift after approval
- Layer 4 (pause gates) catches user mistakes
- Layer 5 (workflow enforcement) prevents silent failures

**Trade-off:** More complex than a single gate, but catches entire categories of failures.

### Decision 2: Approval Freshness via Passport Hashing

**Rationale:** A user approves data, then forgets they changed it, and files outdated information. The hash-binding approach:
- Is cryptographically safe (SHA-256)
- Requires zero human memory (automatic detection)
- Is audit-friendly (provable link between approval and state)
- Scales to any data shape

**Alternative considered:** Timestamp-based expiry ("approval valid for 24 hours"). Rejected because:
- A user can legitimately wait days before filing
- An issue raised moments before filing shouldn't invalidate approval

**Trade-off:** Requires computing and storing hashes, but prevents the silent-drift failure entirely.

### Decision 3: Pause Gates in the Browser, Not the Server

**Rationale:** Pause gates are UX layers to prevent careless mistakes, not security gates. They belong in the browser because:
- They're about user confirmation, not data validation
- Server-side pause gates would require complex state management
- Browser-based pauses are instant feedback (no round trip)

**Trade-off:** A determined user can bypass pause gates (they're not security), but they catch the vast majority of accidental submissions.

### Decision 4: Agents Analyze & Recommend, Not Override

**Rationale:** The harness (compilers, gates, state machine) is the authority. Agents provide analysis and recommendations, but cannot override. This prevents a rouge agent from bypassing checks.

**Pattern:**
```
PublishingRightsCompiler determines readiness → HarnessRun
  ↓
RightsAgent reads HarnessRun → "Blockers: missing IPI from Jane"
  ↓
RightsAgent recommends action → "Get Jane's IPI, then re-approve"
  ↓
User takes action
  ↓
New HarnessRun emitted → Ready!
```

**Trade-off:** Agents are less powerful (they can't force things), but the system is more predictable and safer.

## Harness Primitives (12 Formal Patterns)

The harness implements 12 architectural primitives documented in `.agent/skills/agentic-harness-architect/SKILL.md`:

1. **Tool Registry** — Tools are explicit, typed, scoped
2. **Tiered Permissions** — read/write/destructive classification per tool
3. **Session Persistence** — workflow state survives interruption
4. **Workflow State Machine** — discrete steps with idempotent transitions
5. **Token Budgeting** — per-execution token limits
6. **Streaming Events** — real-time progress updates
7. **Event Logging** — full audit trail (SHA-256 hash chain)
8. **Dual Verification** — blocking + non-blocking checks
9. **Tool Pools** — isolated execution contexts
10. **Transcript Compaction** — context-length management
11. **Permission Audits** — who did what and when
12. **Agent Types** — spoke-and-hub routing, no cross-agent shortcuts

## Integration Points

### RegistrationForm (Entry)

`packages/renderer/src/modules/registration/components/RegistrationForm.tsx`

The registration form is where the harness is invoked:

1. User clicks "Submit"
2. Form compiles the readiness harness
3. If blockers exist → form displays error and blocks submit
4. If approval gate exists → form requests approval
5. If approval exists but is stale → form invalidates it, requests re-approval
6. Two pause gates (certification, final submit) confirm user intent
7. Only then does the form call `adapter.submit()`

### PublishingRightsCompiler (Rules)

`packages/renderer/src/services/publishing/PublishingRightsCompiler.ts`

Implements the readiness rules for publishing/mechanical rights:

- Checks: writer splits sum to 100%
- Checks: IPI/CAE assigned to every writer
- Checks: publisher share = 100%
- Checks: PRO registration status
- Checks: ISWC assignment
- Emits: blockers, findings, recommendations, approval gates

### PassportHashService (Freshness)

`packages/renderer/src/modules/registration/services/PassportHashService.ts`

- `computePassportHash(track)` — SHA-256 of legally-material fields
- `validateApprovalFreshness(track, storedHash)` — detects drift

### WorkflowStateService (State Machine)

`packages/renderer/src/services/agent/WorkflowStateService.ts`

- `advanceStep(userId, executionId, stepId, result, blockers?)` — blocker-aware transition
- `skipStep()`, `failStep()` — explicit state changes
- `getExecution()` — retrieve current state

### Agent Prompts (Discipline)

`packages/renderer/src/agents/rights/prompt.md`, `agents/legal/prompt.md`, etc.

Every agent prompt includes:

- Harness discipline block (read HarnessRun, respect blockers, never override gates)
- Hub-and-spoke routing (no cross-agent shortcuts)
- Version info (prompt_version, schema_version, agent_version)
- "Prepare don't execute" doctrine (analyze & recommend, never act)

## Summary

The RightsOps harness is a multi-layer, agent-coordinated system that makes copyright registrations impossible without complete, approved, fresh data. It does this by:

1. **Checking readiness** (compilers emit blockers)
2. **Requiring explicit approval** (gates block progress)
3. **Detecting drift** (freshness validation via hashing)
4. **Confirming intent** (pause gates for user confirmation)
5. **Enforcing state transitions** (workflow advancement guarded by blockers)
6. **Routing to agents** (recommendations routed to correct departments)

The harness is the source of truth. No agent, no user, no code can bypass it.
