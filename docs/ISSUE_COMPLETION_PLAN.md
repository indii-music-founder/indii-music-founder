# Issue completion plan

## Purpose

Bring the active issue program to a truthful close on `main`: every fixed item
has reproducible evidence, every residual item has a bounded implementation
and acceptance path, and no tool or UI claims completion before its underlying
service has completed it.

## Ledger decision

`OPEN_ISSUES_V2.md` is the active ledger for new work, but its current
ISSUE-1090 and ISSUE-1091 identifiers collide with unrelated archived entries.
Before adding or closing work, preserve the archive and correct V2's identity
mapping so new MCP entries have unambiguous references. `OPEN_ISSUES.md`
remains historical evidence for issues through ISSUE-1089, as its header
states; it is not rewritten or renumbered.

## Delivery sequence

1. Establish the source of truth.

   - Inventory V2, the archive's still-partial/high-risk entries, Sentry, and
     CodeRabbit findings.
   - Deduplicate stale or colliding records without converting partial evidence
     into a fixed status.
   - Record every remaining item in the active ledger with an owner boundary,
     dependencies, and observable acceptance criteria.

2. Improve the routing harness.

   - Evaluate the repository's `skill-skill` workflow against realistic issue,
     security, deployment, and shared-worktree prompts.
   - Add the missing decision rules: active-ledger precedence, issue-ID
     collision detection, external-state proof requirements, and one-mainline
     delivery discipline.
   - Run the required skill-creator evaluation loop before accepting the
     revised router.

3. Complete the MCP foundation.

   - Prove deployed authenticated SSE round trips and enforce per-tool
     authorization from the caller identity.
   - Make the structured operation-result contract the sole response model:
     idempotency, status, evidence, approval state, and genuine `isError`
     failures.
   - Remove or replace every fake processor and queue-as-success response.

4. Complete MCP-backed business capabilities in dependency order.

   - Audio/creative: canonical Audio DNA read, byte-inspected assets, real
     Remotion dispatch and output evidence.
   - Rights/distribution: dual-evidence sample clearance, immutable
     split-sheet PDF, truthful CWR/DDEX drafts and delivery gates.
   - Finance: reconciled recoupment, immutable approval-gated payout staging,
     then separately authorized execution.
   - Brand/publicist: owner-scoped data, persisted campaign timeline, and
     backend-only generated pitches with delivery evidence.

5. Close residual production-critical archive issues.

   - Prioritize the deployment/live-evidence class: audio generation,
     cost-reservation reconciliation, Vertex image rollout, audio profiling,
     and MCP endpoint authentication.
   - Treat credentials, paid spend, partner registration, and legal approvals
     as explicit acceptance prerequisites—not reasons to fabricate closure.

6. Seal each delivery.

   - One coherent commit on current `main`; exact refspec push; inspect the
     exact-SHA CI run and fix only logged root causes until green.
   - Update the active ledger only with evidence from local tests, production
     probes, or the relevant external authority.
   - Complete the issue-sweep loop: Sentry/CodeRabbit triage, regression-plan
     generation, executable verification, test history, and final CI evidence.

## Definition of complete

An issue is `✅ FIXED` only when its code path is present, automated coverage
passes, its persisted/security boundary is verified where applicable, and any
required deployed or external effect is evidenced. Otherwise it remains
`🟡 PARTIAL`, `🔴 OPEN`, or explicitly blocked with the precise prerequisite.
