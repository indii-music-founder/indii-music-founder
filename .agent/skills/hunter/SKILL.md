---
name: hunter
description: Broad, evidence-first bug and security hunting across an explicitly bounded indii scope. Use when the user asks for a latent-bug sweep, security/correctness hunt, or broad audit beyond one known failure. Default to findings-only; enter fix mode only when the user has authorized those bounded code changes. Do not use for one specific bug (use diagnose) or merely selecting affected tests (use test).
---

# Hunter

Find systemic defects without turning pattern matches into speculative code churn. A scan hit is a lead; reproduction and contract evidence determine whether it is a bug.

## 1. Establish the hunt contract

Record:

- included packages, paths, and defect classes;
- excluded areas and unrelated dirty files;
- mode: **AUDIT** by default, or **FIX** only when bounded fixes were requested;
- maximum time or number of findings;
- required proof and output location;
- whether live-user or external validation is in scope.

Read `.agent/workflows/branch-safety.md` before code, git, CI, or push actions. Read `.agent/REAL_USER_AUTHENTICITY.md` before live-user or production claims.

## 2. Start observationally

Use `rg`, repository validators, typecheck/lint output, test failures, dependency analysis, and code reads to find candidates. Never load credentials from `.env`, print secret values, infer replacement secrets, or mutate external services during discovery.

Prioritize:

1. authentication, authorization, ownership, path containment, injection, and secret exposure;
2. money, royalties, tax, identity, distribution, deletion, and durable job-state integrity;
3. race conditions, transaction boundaries, stale state, retry/idempotency, and cancellation;
4. swallowed errors, infinite loading, leaks, and unbounded resource use;
5. public API/schema/literal drift and cross-package contract mismatches;
6. accessibility, locale, performance, and maintainability defects with observable impact.

Do not mechanically rewrite every `fetch`, `catch`, `console`, `Date.now`, `Math.random`, listener, or floating-point expression. Prove the relevant path is defective first.

## 3. Reproduce and rank

For each candidate:

- identify the entry point and affected user/system behavior;
- produce a minimal deterministic reproducer when possible;
- distinguish confirmed defects from suspicious patterns and false positives;
- rank severity by impact, reachability, likelihood, recoverability, and data sensitivity;
- check the active error/issue ledger for identity collisions without copying stale fixes blindly.

## 4. Fix mode

When FIX mode is authorized:

1. Change only confirmed, in-scope causes.
2. Add a regression test through the closest stable public contract.
3. Preserve authentication and authorization boundaries.
4. Do not delete tests, weaken assertions, add timeouts as a substitute for state handling, or replace one global pattern blindly.
5. Keep all related fixes in the parent task's coherent uncommitted change; Hunter does not commit or push independently.
6. After two failed attempts using the same mechanism, stop, instrument, and change the architectural approach.

## 5. Verification

Run checks proportional to fan-out:

- targeted tests for each confirmed defect;
- relevant typecheck and lint;
- package build/integration checks for shared contracts;
- rules/security tests for policy changes;
- approved browser evidence for UI defects;
- genuine real path only when credentials and authority are available.

A broad full-repository gauntlet belongs at the delivery gate, not at the start of every hunt.

## 6. Output

```markdown
# Hunter Report
- Scope and mode:
- Commands and evidence:
- Confirmed findings:
- Suspected/unconfirmed findings:
- False positives:
- Fixes applied (FIX mode only):
- Regression evidence:
- Remaining risk and fallback:
- Verdict: CLEAN FOR SCOPE | FIXED FOR SCOPE | PARTIAL | BLOCKED
```

Write to a permanent issue ledger only when the finding is verified, uniquely identified, not already represented, and the current task authorizes that ledger update.
