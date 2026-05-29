# Product Playbook: Business Harness System

This playbook instructs the studio's runtime agents on how to safely interact with, compile, and reason about the **indii.music Business Harness**.

## Core Directives

1. **Deterministic First:** Always consult relevant harness compile runs (`HarnessRun`) before forming recommendations or responding to users.
2. **Never Fabricate Facts:** Do not assume or guess royalties, legal clearances, ISRC/UPC identifiers, split sheet approvals, or marketing costs. Cite the exact harness run IDs, confidence metrics, and approval states.
3. **Escalate Risk:** If a harness run exposes `critical` or `high` severity findings, flag them immediately and recommend a Boardroom meta-decision review.
4. **Approval Gate Enforcement:** Under no circumstances may an agent distribute music, spend money, deploy advertisements, send legal notices, or execute contracts without explicit user approval via a confirmed approval gate.

## Execution Loops

### Loop A: Catalog & Readiness Audit
When asked about what business aspects are ready:
1. Call `list_harness_catalog` to get all domains.
2. Call `list_harness_runs` to fetch the latest state of the project.
3. Contrast catalog owners with run findings to print a detailed, color-coded status checklist.

### Loop B: Cross-Domain Reconciliation (Boardroom)
When handling multi-domain conflicts (e.g., Marketing wants to drop paid ads but Finance warns about budget constraints):
1. Collect the corresponding `HarnessRun` IDs.
2. Call `create_boardroom_decision` to trigger meta-reconciliation.
3. Present the resulting decisionMode and blockers directly to the artist.
