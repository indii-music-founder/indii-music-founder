---
description: Observational audit of agent instructions, specs, plans, handoffs, and code notes against the current codebase and git history. Uses TypeSafe JEV as an advisory semantic triager; deterministic code and git evidence decide. Reports first; archives or edits only after named approval.
---

# /sweep — Stale-Context Audit

Use `/sweep` to find outdated agent context before it sends an agent on a side quest: instruction files, specs, plans, handoffs, and TODO/FIXME/BUG/HACK/NOTE comments that no longer match the code. It is also called, always report-only and scoped, from `/start`, `/proceed`, `/middle`, `/end`, `/go`, `/opp`, `/review`, `/flowchart`, `/better`, `/api`, `/db-sync`, `/plat`, `/broken`, `/walk`, and the `go`, `walk`, and `health_audit` skills (see those files).

**Authority:** Phases 1–4 are read-only. Phase 5 writes only what the user approved, inside the active task, as part of one coherent commit on `main`. Standalone `/sweep` never commits or pushes by itself.

## Principles

- **Code is the source of truth.** When a doc, rule, or spec disagrees with implemented code, trust the code, unless the ticket is explicitly in progress. An in-progress spec guides half-built code; incomplete code never makes it stale.
- **History before verdict.** A note that looks old may be the only record of why a workaround exists. Check `git log -S` and `git blame` before flagging anything.
- **No proof, no change.** Without deterministic evidence of obsolescence, the item is Kept.
- **Never auto-delete.** Report first; wait for approval before archiving or editing.
- **JEV advises; evidence decides.** A JEV answer alone never moves an item to Verified Stale.

## Protected zones (ask, never classify stale)

Per `CLAUDE.md` §7 asset-deletion fail-safe: anything under `.agent/skills/`, `.agent/workflows/`, `execution/`, or prefixed `indii-` is mission critical. If it looks outdated, put it under Conflicts as the question "What is `<asset>` used for?". Also never sweep:

- `.agents/skills/` (vendored, read-only; changes go through the installer and `skills-lock.json`);
- `.agent/test_ledger/OPEN_ISSUES_V3.md`, `.agent/test_ledger/OPEN_ISSUES_V4.md`, `.agent/skills/error_memory/ERROR_LEDGER.md`, `docs/audits/`, and existing `archive/` or `.agent/test_ledger/archive/` content. These are dated history by design;
- defensive regression comments whose `git log -S` reason has not been read.

## 1. Inventory

Scan, excluding the protected and archived paths above:

- instruction files: `CLAUDE.md` plus its mirrors (`GEMINI.md`, `CODEX.md`, `ANTIGRAVITY.md`), `AGENTS.md`, and files under `.claude/`, `.gemini/`, `.codex/`;
- context: `.agent-os/product/`, `directives/`, `skills/`, `.jules/`, `docs/` (non-audit), `.agent/HANDOFF_STATE.md`, `.agent/artifacts/`, `.claude/plans/`, `.claude/checkpoints/`;
- ticket status tags (completed / in progress / not started);
- code comments: `TODO`, `FIXME`, `BUG`, `HACK`, `NOTE` referencing bugs, tickets, or removed features.

When invoked from another workflow, limit the inventory to files and symbols the current diff touches or renames.

## 2. Verify against code and git history

For each candidate:

1. **Current state:** does the referenced file, route, symbol, flag, or feature still exist as described?
2. **History:** `git log -S "<symbol_or_keyword>" -p` and `git blame` on the surrounding lines. Was the bug fixed, the feature dropped, or the reason still valid?

A shallow clone cannot answer history questions. Deepen with a bounded fetch, or mark the item Kept (insufficient history). Never run an unbounded fetch.

## 3. JEV semantic triage (advisory)

Use TypeSafe JEV where meaning, not a string, decides: does this note's described situation still match the code now in front of it, and do two rules say incompatible things.

- **Activate** per [`start.md`](start.md) §5.5: source `TYPESAFE_API_KEY` from `.env` or the shell, never print, commit, or transmit it anywhere except the TypeSafe API call. Use the System One call shape in `scripts/typesafe-shadow-experiments.mjs` (`jev-latest`). If the key is unavailable, skip this phase and say so; the sweep still completes on deterministic evidence.
- **Primitives:** `Noul` for "still accurate against this code excerpt?"; `Choice` for `accurate | outdated | contradicted | unclear`; `Score` only for ranking review order.
- **State** per item is the note text plus the minimal relevant code excerpt, never whole files or secrets. Batch items into few calls and record the token cost.
- **Questions and thresholds** are fixed in this section so they stay reviewable. Treat confidence below 0.65 as `unclear`.
- **Use of output:** JEV orders the review queue and surfaces candidate Conflicts. It may downgrade a deterministic finding to Kept when it flags that the note's original reason still holds. It never upgrades an item to Verified Stale and never overrides Phase 2 evidence.
- JEV does not establish ownership, permission, security authorization, or deterministic identifiers. Those stay in code and git.

## 4. Independent fact-check, then report

Before reporting, run a separate verification pass (a fresh subagent if available, otherwise a clean re-check). Pass it only the specific claims and `path:line` references. Do **not** pass your hypothesis or any JEV score or verdict, so it cannot be steered toward agreement. Any rule, memory note, or spec that directly contradicts the code (renamed route, dropped sign-in method) is a **Conflict**, not automatically stale.

Report in chat only. Do not create a report file or append to a ledger (`CLAUDE.md` §8 forbids standalone issue files; log a real defect in `.agent/test_ledger/OPEN_ISSUES_V4.md` only when the user asks).

```text
VERIFIED STALE: <path:line — evidence (code state + git log/blame result)>
CONFLICTS: <instruction/spec vs code — user decides which side to update; includes protected-zone questions>
KEPT (INSUFFICIENT PROOF): <items checked and left untouched>
JEV: <used | skipped: reason> — <items triaged, calls, tokens>; advisory only
```

Ask which Verified Stale items to archive or remove and how to resolve each Conflict. Stop.

## 5. Apply (only after approval)

1. Move approved stale docs and plans into the root `archive/`, preserving relative paths. Remove approved stale code comments.
2. Update conflicting instruction files per the user's decision. Edit `CLAUDE.md` first, then copy it verbatim to the five mirrors; keep `AGENTS.md` aligned separately. Prune superseded rules instead of appending new ones.
3. Block re-reading of the root `archive/` (not `.agent/test_ledger/archive/`, which `CLAUDE.md` still points agents to):
   - Claude Code: a `PreToolUse` hook in `.claude/settings.json` denying `Read`, `Grep`, and `Glob` on `archive/**`.
   - Gemini CLI and Codex: add `archive/` to `.geminiignore` (and `.aiignore` if used), plus one line at the top of `CLAUDE.md` and its mirrors and `AGENTS.md`: do not read or search `archive/`.
4. If any workflow or registry file changed, regenerate and check: `npm run capabilities:generate`, then `npm run validate:capabilities` and `npm run validate:mainline-workflows`. Re-run any gate an edit invalidated.
5. Deliver under [`branch-safety.md`](branch-safety.md) as one coherent commit, or hand the staged change to `/end` when called from it.

## Gotchas

- Never mark an in-progress ticket's spec stale because the code is incomplete.
- Never archive or delete a defensive comment without reading why `git log` says it was added.
- Do not bloat `CLAUDE.md` or its mirrors while resolving conflicts.
- Never use `/sweep` findings to justify removing a skill or workflow absent from `WIIL-skill.md`; absence from a manifest is not grounds for deletion.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
