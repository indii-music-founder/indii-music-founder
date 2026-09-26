# indii.music — AI Control Stack

**As of:** 2026-09-26  
**Purpose:** Evidence-backed description of the runtime controls governing indii.music specialist agents.

The agent system is best described as **five principal control layers**. Several layers contain multiple independent checks, so counting every sub-gate separately produces a larger number.

## Layer 1 — Specialist identity, scope, and organizational boundaries

Purpose: keep each agent inside its assigned role and preserve provenance across multi-agent work.

Repository evidence:

- `SpecialistAgentFactory.ts` binds each specialist to an A2A card and freezes its configuration.
- `AgentIdentity.ts` creates per-instance IDs, deterministic configuration fingerprints, and delegation provenance records.
- `AgentCommunicationPolicy.ts` enforces department and Boardroom boundaries:
  - direct mode does not permit delegation;
  - department tasks cannot cross department boundaries;
  - only department heads may assign work to department workers;
  - Boardroom is manager-to-manager context sharing, not peer task assignment;
  - employees do not sit at the Boardroom manager layer.

Important precision:

The current identity system uses SHA-256 fingerprints for immutable configuration provenance. Its current "attestation" token is encoded provenance data, not a third-party cryptographic certificate or independently signed identity credential. Do not overstate this as external cryptographic attestation.

## Layer 2 — Input security and execution circuit breakers

Purpose: stop unsafe or runaway work before inference or continued execution.

Repository evidence:

- `ModelArmor.scanInput()` intercepts the immediate task before the model call and blocks configured prompt-injection/system-boundary patterns.
- The scan deliberately isolates current user/task content from prior conversation metadata to avoid self-triggered false positives.
- `BaseAgent.ts` contains a budget circuit breaker before continued agent execution.
- The iteration loop has a final-step limit that forces the agent to stop calling tools and compose a final response rather than running indefinitely.

Important precision:

This is a custom in-repository ModelArmor implementation. It should not be described as an external certification or independent security service unless separately verified.

## Layer 3 — Tool risk, deterministic execution, and human approval

Purpose: prevent a language model from directly performing consequential actions without the correct execution path.

Repository evidence:

- `ToolRiskRegistry.ts` classifies tools by read/write/destructive risk and approval requirements.
- `BaseAgent.ts` checks explicitly approval-gated tools **before execution**.
- `ToolApprovalService.ts` persists the pending action and pauses execution.
- Human approval executes the **exact original tool call**, rather than rerunning the LLM turn and allowing it to reason into a different action.
- Computer-control approvals add a main-process authorization token and verified desktop sign-in.
- `ToolExecutionContext.ts` provides transaction-style state isolation, including commit/rollback behavior, so tool changes can be tracked and rolled back rather than mutating global state blindly.
- Exact calculations, identifiers, authorization, security policy, and other deterministic operations are intentionally assigned to code/tools rather than probabilistic text generation.

Important precision:

The BaseAgent approval gate currently fires for tools explicitly marked `requiresApproval: true`. The code deliberately does not apply the broader "unknown tool = approval required" fallback to every custom agent function because that would gate a large set of local specialist tools. This is a real design boundary, not a universal fail-closed guarantee.

## Layer 4 — Output truth, semantic verification, and data-leakage controls

Purpose: stop an agent from presenting unsupported certainty or leaking sensitive data after generation.

This layer contains three separate checks:

### 4A. Deterministic capability-truth guard

`capabilityTruth.ts` detects known classes of unsupported statements such as:

- blanket claims that all departments/systems are fully implemented or production-ready;
- unsupported claims that engineering work is complete;
- known ungrounded capability/hallucination patterns.

When triggered, `BaseAgent.ts` replaces the response with a grounded capability report.

### 4B. Output ModelArmor / DLP scan

`ModelArmor.scanOutput()` scans final text and redacts configured secret/PII patterns such as API keys, tokens, private keys, payment-card patterns, connection strings, and similar sensitive material.

### 4C. Jev / TypeSafe semantic guardrail

`JevGuardrailService.ts` evaluates the response against typed semantic questions, including whether the response:

- claims a platform is disconnected without checking;
- claims something was scheduled without a scheduling tool;
- claims a concrete action completed without tool evidence;
- claims production/readiness verification without live evidence;
- is actionable.

The current fire threshold is 0.7.

Important precision:

Jev is deliberately **soft-fail**: on timeout or upstream failure it passes the response through rather than blocking the entire interaction. It is an additional semantic control, not the sole safety boundary.

## Layer 5 — Post-output autorating, correction, escalation, and learning

Purpose: independently evaluate results after the specialist produces them, correct failures, and surface unresolved problems.

Repository evidence:

### Visual output autorater

`VisualOutputAutorater.ts` evaluates generated images against the original brief for:

- subject match;
- scene match;
- mood;
- technical adherence.

Current hard thresholds require subject and scene scores of at least 8/10 plus an overall-pass verdict.

Failed images can receive a corrective prompt and regenerate, but correction attempts are capped at **2** to prevent runaway loops. After the cap, the design surfaces manual review rather than iterating indefinitely. Autorater decisions are written to an audit trail.

### Multi-turn autorater

`MultiTurnAutorater.ts` independently scores conversation traces for:

- goal completion;
- guideline adherence;
- coherence;
- tool efficiency.

High-quality traces can be registered for later fine-tuning/continuous improvement.

This is a quality/learning loop rather than a hard synchronous blocker.

### Truth-overclaim repair loop

`truthOverclaimReporter.ts` can turn a detected unsupported readiness claim into a structured bug report through `reportBugFn`, with dedupe/cooldown behavior.

This links output governance to the repair system instead of merely logging a bad answer.

## The practical model

At a high level:

```text
User / founder request
        ↓
1. Specialist identity + department scope
        ↓
2. Input security + budget/iteration circuit breakers
        ↓
Model reasoning
        ↓
3. Risk-classified deterministic tools + human approval
        ↓
Agent response
        ↓
4. Deterministic truth check + output DLP + Jev semantic check
        ↓
User-visible result
        ↓
5. Autorater / audit / corrective loop / bug escalation / learning
```

## Why this matters

The architecture does not assume that the AI specialist is correct because it generated an answer.

The system separates:

- **who is allowed to handle the task;**
- **what can enter the model;**
- **what the model is allowed to execute;**
- **what claims it may present as true;**
- **whether the result actually met the user's goal.**

That distinction is central to the indii.music technical-founder story.

## External wording

A concise, defensible description:

> indii.music uses a layered agent-control architecture. Specialist agents are bounded by identity and department scope; inputs are screened before inference; consequential tools are risk-classified and can require explicit human approval; outputs pass deterministic truth, data-leakage, and semantic evidence checks; and separate autoraters evaluate results and feed failures into correction, escalation, and continuous-improvement loops.

Do not compress this to "AI guardrails." The important engineering fact is the separation of responsibilities across independent control layers.

**Last updated:** 2026-09-26
