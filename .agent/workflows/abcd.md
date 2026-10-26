---
description: Full ABCD engine launch workflow. Starts the coordinated testing/build/CI/CD loop by activating /a, /b, /c, and /d as discoverable Engine A/B/C/D roles.
---

# /abcd — Full Engine Swarm Workflow

**Activates the full Engine A/B/C/D testing, build, CI/CD, and verification loop.**

Use this command when you want one launch point for the whole internal engine system. The engines may run in one AI app or be split across Codex, Claude, Gemini, or another app. They coordinate through repo artifacts, not hidden chat state.

## 0. Engine Map

| Engine | Slash | Role | Writes Code? | Primary Artifact |
| --- | --- | --- | --- | --- |
| Engine A | `/a` | Finder: run real tests and log real issues | No | `.agent/test_ledger/OPEN_ISSUES_V2.md` |
| Engine B | `/b` | Fixer: claim one issue, fix it, verify locally, commit | Yes | Code + ledger fix evidence |
| Engine C | `/c` | Shipper: keep the exact pushed main SHA green and deployment-safe | Yes, for CI/release issues | GitHub Actions + deployment evidence |
| Engine D | `/d` | Verifier: audit FIXED/shipped claims and re-open fakes | No product code | Ledger verification/re-open notes |

## 1. Discovery Contract

Before launching sub-workflows, every engine must discover current state from disk:

1. Read `.agent/workflows/a.md`, `.agent/workflows/b.md`, `.agent/workflows/c.md`, and `.agent/workflows/d.md`.
2. Read `docs/testing/ENGINE_ABCD_COORDINATION.md`.
3. Read `.agent/test_ledger/OPEN_ISSUES_V2.md`.
4. Check `git status` and do not overwrite unrelated dirty files.
5. Check for active prototype engine folders under `.agents/teamwork_preview_*` and treat them as active work owned by other agents unless the user says otherwise.

## 2. Launch Sequence

Run the engines in this order:

1. **Start Engine A (`/a`)** so the issue ledger is fed by real tests and real browser findings.
2. **Start Engine B (`/b`)** so one open issue is claimed, fixed, verified locally, and committed.
3. **Start Engine C (`/c`)** so the exact pushed `main` SHA reaches green and CI/CD failures become first-class issues.
4. **Start Engine D (`/d`)** so B/C claims are independently checked against real code and tests.

If the user explicitly says "launch A then B then D", run A, B, and D first. C can join later; D must not pretend CI/deploy verification happened unless it actually checked the evidence.

## 3. Coordination Rules

- **One lane per engine:** A finds only, B fixes only, C ships only, D verifies only.
- **One issue per fixer loop:** B claims exactly one issue at a time before editing code.
- **Immediate ledger commits:** any engine that edits `.agent/test_ledger/OPEN_ISSUES_V2.md` must commit that ledger edit immediately after a pull/rebase.
- **No fake green:** tests may not be skipped, loosened, or replaced with mocks to make a claim pass.
- **No hidden handoffs:** all handoffs go through `.agent/test_ledger/OPEN_ISSUES_V2.md`, commit messages, GitHub Actions evidence, or explicit files under `.agents/`.
- **Cross-app safe:** do not rely on memory from one AI app. If Claude, Gemini, and Codex all run, disk artifacts are the source of truth.

## 4. Completion Standard

The `/abcd` loop is healthy when:

- A is writing only evidence-backed findings.
- B is marking issues fixed only with code evidence and local verification.
- C shows the exact pushed `main` SHA is green or files honest CI issues.
- D samples B/C claims and either confirms them or re-opens them with evidence.

The workflow is not complete just because one engine says "done"; D's verification and C's CI evidence close the loop.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
