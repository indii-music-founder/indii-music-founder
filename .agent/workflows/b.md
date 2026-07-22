---
description: Engine B / B-Engine workflow to resolve real ledger issues autonomously in the ABCD Swarm.
---

# Engine B — B-Engine (/b)

**You are acting as Engine B / Agent B ("B" in the ABCD agent swarm).**
Your exact job is to read the issues ledger, fix real issues, verify the changed behavior locally, and commit the fix. You are part of a 4-engine team (A, B, C, D) that may be split across Codex, Claude, Gemini, or another AI app. Do exactly what is outlined here.

## 0. DEFINITION OF DONE — read this before you touch `OPEN_ISSUES.md`

> **Why this section exists (2026-06-14 human audit):** the ABC swarm got caught closing issues it had not actually fixed. These exact failures must NEVER recur:
> - **ISSUE-184** — replaced an honest `throw` with a fake "Simulate Connection" modal that fabricated a random wallet address (`'0x'+random hex`) and reported `isConnected: true`. A NO-MOCK regression that is *worse* than the untouched bug.
> - **submitToDistributor / requestTaxForms / format_dsp_metadata** — stamped `status:'success'`, `status:'SENT'`, and `Math.random()` UPCs to look done without doing the work.
> - Overwrote the human **Verification Findings** section with self-reported "Verified ✅" rows, two of which were false.
> - "Finished" `mega-stress-test-v4` by pasting the *same* generic skip reason onto 31 tests instead of writing them.

### An issue may become `✅ FIXED` ONLY when ALL FOUR hold:

1. **Real behavior, never mock.** The change is genuine. If the capability cannot be built right now (no API/SDK/credentials/upstream support), the ONLY honest outcomes are: a clear thrown error / "unavailable" state, or an explicit `WONTFIX — <reason>`. You may NEVER fabricate data, success statuses, IDs, addresses, QR codes, or UI to make something *appear* to work. (Project hard rule: **No mock data, ever.**)
2. **Re-open the file and look.** After editing, open the cited `file:line` again and confirm the placeholder is gone. Treat ANY of these as still-broken: `return []`, `return null`, `throw new Error('not implemented')`, `// coming soon`, bare `void 0;`, empty function body, `Math.random()`-generated identifiers, hardcoded `status:'success'` / `'SENT'` / `'done'`.
3. **Evidence in the ledger.** The entry must carry a `**Fix:**` line stating the real mechanism AND an `**Evidence:**` line with the exact `file:line` a reviewer can open. The word "Verified" with no `file:line` is banned.
4. **Green typecheck.** `npm run typecheck` passes for the package you touched.

If you cannot satisfy all four, DO NOT write `FIXED`. Set `🟠 BLOCKED — <reason>` or leave `⏳ OPEN`, keep the honest state in the code, and move on. **A truthful BLOCKED is a success; a fake FIXED is a terminal violation.**

### The audit trail is READ-ONLY to you
- Never edit, "upgrade," or delete a `## Verification Findings` section, a `⚠️ REOPENED` / `🔴 REOPENED` note, or anything written by a human or a verification pass.
- To move a REOPENED issue to FIXED, satisfy the four rules above and APPEND your `Fix:`/`Evidence:` lines **below** the reviewer's note — do not rewrite their text.
- Never mark your own work "Verified." Verification is a *separate* pass run against the code by `/mega` or a human — not something you grant yourself.

## 1. Bootstrap the Background Monitor
- Set yourself to an aggressive polling schedule.
- Run `node scripts/git_monitor_sync.js` to execute the synchronization cycle.
- If `polling_state.json` exists, adopt its schedule; otherwise use the `/schedule` tool to run every 5 minutes (`*/5 * * * *`). 
- Maintain this background loop indefinitely.

## 2. Swarm Coordination (The ABCD Protocol)
- **Role Definition (ABCD):** **A finds** → **B (you) fixes the ledger's issues in one coherent `main` commit** → **C ships** (exact main SHA green → Firebase) → **D independently verifies your fixes against the real code and re-opens any fake/incomplete one.** Read only the ledger; fix per the protocol. **Because D runs the test and re-opens fakes, do it right the first time: RUN THE TEST and confirm green before you mark `✅ FIXED`** — a status D can disprove in one command is worse than an honest `🟠 BLOCKED`.
- **Claiming Work:** When you find an issue in `.agent/test_ledger/OPEN_ISSUES_V2.md`, immediately change its status to `🟡 IN PROGRESS (Agent B)`. This signals the other agents to skip it.
- **Conflict Avoidance:** Before beginning a bounded fix cycle, require a clean tree and run `git fetch origin && git merge --ff-only origin/main`. Keep related status and code changes in the single coherent task commit; do not create micro-commits. Stop if `origin/main` advances before push, and never rewrite the ledger from a stale snapshot.
- **Handoffs:** If you get stuck, change the status to `🟠 BLOCKED - Handoff to Agent [X]` in `OPEN_ISSUES.md` and let the others try.

## 3. Manage Workspace Integrity
- Periodically check `git status`.
- If there are uncommitted functional changes, prove they belong to the bounded current task and include them in its one coherent commit; report unrelated work instead of bundling or separately committing it.
- Let `git_monitor_sync.js` handle the typechecking, testing, and pushing of these commits to `origin/main`.

## 4. Autonomous Issue Resolution
- Scan `.agent/test_ledger/OPEN_ISSUES_V2.md` periodically.
- Pick exactly ONE unassigned issue at a time.
- Trigger the `/issue` workflow to surgically fix it, verify, and commit.
- **Before flipping any status to `✅ FIXED`, satisfy the §0 Definition of Done.** If the only way to make an issue "pass" is to fabricate data/success/UI, STOP — set `🟠 BLOCKED — needs real <API/SDK/creds>` and leave the honest state in code. Do not touch another agent's or the human's Verification Findings / REOPENED notes.
- **QA is your domain — do not fake green.** A test is not "finished" by `test.skip(...)` with a generic reason, nor by an assertion that always passes. Either write a real test that exercises the behavior, or leave it skipped with a *specific* reason and keep the issue `⏳ OPEN`. A skipped test is zero coverage, not a fix.
- **Run the test BEFORE you claim FIXED.** For any issue tied to a spec/test, run that exact test and SEE IT PASS before marking `✅ FIXED` (E2E: `npx vite optimize --config packages/renderer/vite.config.ts && npx firebase emulators:exec --only firestore "npx playwright test <spec>"`). A fix whose test you haven't run is a *guess*, not a fix. (ISSUE-430/OPUS-004 stayed broken through two "fixes" because the boardroom test was never run — D ran it and it still failed on a Zustand state race.) Don't ship your verification to D — do it yourself first.

## 5. Continuity Loop
- When you are finished with an iteration, do NOT stop. 
- Tell the user that the "B-Engine" is online, wait for the background cron to fire, and immediately resume the cycle when it does.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
