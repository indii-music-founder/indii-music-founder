---
name: health-audit
version: 2.0.0
description: Full repository engineering health and ship-readiness audit for indii. Use when the user asks for overall codebase health, readiness to ship, unfinished systems, security posture, dependency health, CI health, or prioritized technical risk across multiple packages. Do not use for a quick hidden-pattern delta (use health-check) or one known bug (use diagnose).
---

# Health Audit

Produce a current, evidence-backed readiness report. Default to read-only: this skill identifies and prioritizes work but does not silently turn the audit into a repository-wide fix campaign.

## 1. Bound the audit

Record:

- current `main`/`HEAD` and worktree state;
- included packages and readiness target;
- available credentials and external systems;
- checks that would incur cost, write externally, or require production access;
- pre-existing dirty files that cannot be attributed to the audit.

## 2. Evidence dimensions

Run independent read-only checks in safe parallel groups where possible.

### Build and static policy

```bash
npm run typecheck
npm run lint
npm run check:dep-drift
npm run validate:capabilities
```

### Tests and integration

Select proportionally:

```bash
npm test -- --run
npm run test:integration:ci
```

Record skipped suites and why. Test fixtures and mocked providers prove structure, not live acceptance.

### Repository architecture and completeness

- inspect package/module entry points and public contracts;
- find TODOs, placeholders, dead paths, duplicate implementations, and stale status documents;
- distinguish intentionally planned modules from incomplete shipped surfaces;
- verify current paths before reporting missing components.

### Security and data integrity

- run repository security guards and rules tests;
- search for secret-shaped values by filename and line only; never print matched values;
- review authentication, authorization, ownership, path containment, deletion, idempotency, and financial state boundaries;
- never load tokens from `.env` or change repository/CI secrets during an audit.

### Dependencies and runtime health

- run the repository's dependency integrity/drift checks;
- use `npm audit` only as one signal and inspect reachability before ranking a vulnerability;
- record outdated dependencies without upgrading them unless upgrades are explicitly in scope.

### CI/CD and external health

- inspect exact-SHA CI when a relevant pushed SHA exists and official GitHub authentication works;
- if authentication is missing, stop that dimension and provide the official authorization flow;
- do not replace remote evidence with a local green claim;
- Sentry, production analytics, billing, partner delivery, and registry acceptance require their real authenticated sources.

## 3. Classify evidence

Use these labels:

- **Verified current:** reproduced at the audited SHA.
- **Historical:** supported only by older artifacts or runs.
- **Structural:** code, typecheck, unit, mock, or emulator evidence.
- **External verified:** genuine service or production evidence.
- **Unknown:** proof was unavailable.

## 4. Prioritize

Rank findings by user/data impact, reachability, likelihood, recoverability, and dependency fan-out. Do not equate a large grep count with high severity.

## 5. Output

```markdown
# Engineering Health Audit
- SHA and scope:
- Evidence date/environment:
- Overall verdict: READY | CONDITIONAL | NOT READY | UNKNOWN

## Dimension scorecard
| Dimension | Evidence | Status | Key risk |

## Confirmed blockers
## Important non-blocking risks
## Historical or unverified claims
## Recommended order of work
## Checks skipped and prerequisites
## Unrelated dirty state
```

If the user asks to implement fixes after the audit, route confirmed items into bounded `/middle` or `diagnose` work. Keep the audit report separate from proof that those fixes shipped.
