# /pp — Perfect Primitive

Thin Claude entry point for the canonical shared workflow used by **Claude**, **Codex**, and **Gemini Antigravity**.

## Canonical Protocol

Read and follow **`.agent/workflows/pp.md`** step-by-step. It is the canonical contract for audit-only reviews and implementation; this adapter does not define a separate protocol. Gemini Antigravity and Codex should load that same file through their repository workflow/instruction surfaces. If a host cannot load it, report the entry-point gap instead of approximating the workflow.

1. **Select mode:** Audit-only is the default for review/diagnosis requests. Return ranked findings, evidence, confidence, and a proposed bounded unit without editing. Implement only when requested.
2. **Memory & Scope:** Follow the canonical workflow's required memory, authenticity, and quality-standard reads; choose 1–3 tightly coupled defects per implementation unit.
3. **Implementation goal and fix:** Set or reuse the implementation goal as described in the canonical workflow. Reproduce the failure, make the complete minimal fix, and audit sibling callers.
4. **Ledger & Honesty:** Record only verified novel patterns and observed test counts. Keep structural mocks distinct from live/production verification.
5. **Verification & Delivery:** Run the proportional checks from the canonical workflow. Use Entire for Git transport and trail/session management; follow `branch-safety.md` and `/end` for delivery on a task branch, and report the branch, commit SHA, and local verification or the precise blocker. If unrelated work occupies the shared checkout, use an isolated checkout based on `origin/main`.
