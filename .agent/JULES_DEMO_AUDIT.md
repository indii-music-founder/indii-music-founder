# Jules Demo-Audit Runbook

**Generated for asynchronous execution by a smaller model.**
**Working dir:** /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean
**Goal:** Produce a binary GO / NO-GO verdict on whether this app is demo-ready
to a music industry contact today, with evidence for each claim.

## Rules of engagement
1. Run commands head-down. Don't reason about semantics — pass/fail is defined per step.
2. Use `Bash` with absolute paths. Do NOT `cd`.
3. Do not read source files unless a step says to. Trust this runbook.
4. Don't edit any source code. Audit only. The exception: visual sweep findings may
   produce a "Fix-before-demo?" YES, in which case STOP and escalate.
5. If any step requires a judgment call this runbook does not specify, write
   .agent/BLOCKED.md and STOP.
6. Never push, never merge, never run anything destructive.

## Repo facts (do not re-derive)
- npm workspace monorepo. Packages: main, renderer, firebase, shared, landing, sdk.
- Dev server: `npm run dev:web` (port 4243). Full Electron: `npm run dev`.
- Tests: `npm run test:ci` (vitest 4.x, --run mode).
- TS: `npm run typecheck` (multi-project).
- Lint: `npm run lint`.
- Build: `npm run build`.
- Pre-push validator: `npm run ci` (= `bash scripts/ci.sh`).
- Demo-path modules: onboarding, dashboard, creative, video, agent, distribution,
  finance, publishing, marketing, social, settings, files. (12 of 39 total.)

## Output artifacts (you must produce all five)
1. .agent/AUDIT_HOUR1.md
2. .agent/AUDIT_HOUR2.md
3. .agent/DEMO_SCRIPT.md
4. .agent/AUDIT_HOUR4.md
5. .agent/DEMO_GO_NOGO.md

### Pre-flight (5 min)

P1: confirm repo + branch + tree state.
```bash
git -C "$REPO" rev-parse --show-toplevel
git -C "$REPO" branch --show-current
git -C "$REPO" status --short
```
Pass: prints the repo path, prints `main` (or whatever branch the orchestrator put us on), status output is OK to be empty or show known-untracked.

P2: confirm Node ≥ 22.
```bash
node --version
```
Pass: v22 or higher.

P3: confirm `.env` exists.
```bash
test -f "$REPO/.env" && echo OK || echo MISSING
```
Pass: prints OK.

P4: ensure `.agent/` exists.
```bash
mkdir -p "$REPO/.agent" "$REPO/.agent/screenshots" "$REPO/.agent/console_logs" "$REPO/.agent/network"
```

If any preflight fails: write `.agent/BLOCKED.md` with the failure and STOP.

### Hour 1 — Build & Boot Evidence (60 min)

Step 1.1 — Clean install
- `rm -rf node_modules dist packages/*/node_modules packages/*/dist`
- `npm install` (timeout 600000, run_in_background true, then wait)
- Pass: exit 0, no ERESOLVE, no gyp errors.
- Native module errors (keytar/cpu-features/canvas): YELLOW, continue, flag for video/audio modules.
- ERESOLVE: FAIL → NO-GO, STOP.

Step 1.2 — Typecheck
- `npm run typecheck`
- Pass: exit 0.
- ≤5 errors, all in `*.test.*` paths: YELLOW.
- Otherwise: FAIL → NO-GO, STOP.

Step 1.3 — Lint
- `npm run lint`
- Pass: zero `  error  ` lines (warnings OK).
- Errors only in test paths: YELLOW.
- Errors in shipping code: FAIL → NO-GO, STOP.

Step 1.4 — Tests
- `npm run test:ci` (timeout 600000)
- Pass: exit 0, summary shows `0 failed`.
- Failures only under `packages/renderer/src/services/video/`: YELLOW, flag video as RED for Hour 2.
- Failures elsewhere: FAIL → NO-GO, STOP.

Step 1.5 — Production build
- `npm run build` (timeout 600000)
- Pass: exit 0, no terser/Rollup errors, no missing module errors.
- Otherwise: FAIL → NO-GO, STOP.

Step 1.6 — Dev-web smoke test
- Start dev server in background: `npm run dev:web` (run_in_background)
- Sleep 30s once.
- `curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:4243/`
- Pass: prints 200.
- Otherwise: capture background output, FAIL → NO-GO, STOP.
- Leave dev server running for Hour 2.

Step 1.7 — Write AUDIT_HOUR1.md from template (table with 6 rows, one per step,
columns Step / Status / Notes; Errors observed section; Hour 1 Verdict).

Hour 1 gate: any FAIL → write NO-GO, STOP. Any PASS+YELLOW → continue.

### Hour 2 — Cold-start journey (90 min)

Pre 2.0: re-curl 4243, restart dev server if needed.

Step 2.1 — Auth/landing
- Browser tool (Playwright skill or browse): goto http://localhost:4243/, screenshot,
  capture console.
- If login required: STOP, ask William, do NOT guess credentials.
- Pass: real UI rendered, zero console errors, zero failed-to-fetch.

Step 2.2 — Per-module sub-routine, run for each of the 12 demo-path modules:
- Navigate (URL or sidebar click).
- Wait 5s.
- Screenshot pre-action.
- Capture console.
- Capture network failures.
- Trigger primary action per the table in Step 2.2 of plan source (do NOT run any
  AI generation that costs tokens).
- Wait 5s.
- Screenshot post-action.
- Re-capture console.

Per-module verdict: GREEN / YELLOW / RED.

Write AUDIT_HOUR2.md from template (auth row + 12-row matrix + screenshots index).

Hour 2 gate: any RED on demo-path → STOP. Surface the RED list to William with three
options (skip those modules / fix now / NO-GO). Don't pick for him.

Hour 2 fix protocol (only if William picks "fix now"):
- Read console error.
- Check ERROR_LEDGER for match. If match: apply documented fix.
- If no match: STOP. Escalate to William.

### Hour 3 — Lock the demo (60 min)

Step 3.1 — Pick the backbone (the 8-beat 9:30 walkthrough from the plan).

Step 3.2 — Stage demo data:
- One audio fixture for DNA extraction.
- ≥1 generated image visible in creative.
- ≥1 agent task with non-empty result.
- 1 distribution release record (or screenshot fallback).
- Finance dashboard with non-empty data.

Document each in DEMO_SCRIPT.md. Where data is missing, ask William rather than fabricate.

Step 3.3 — Pre-record fallback video to .agent/demo_fallback.mp4. If Jules can't
record, write .agent/MANUAL_3_3.md telling William to record before walking out.

Step 3.4 — Write DEMO_SCRIPT.md from template (pre-demo checklist, beat-by-beat
walkthrough with exact words to say, the ask, fallback procedure, modules NOT on
the path).

Step 3.5 — Two timed rehearsals. Trim any beat 25% over budget.

### Hour 4 — Polish & /plat gate (60 min)

Step 4.1 — Run `/plat` if available, otherwise the manual equivalent:
- `git status`
- `git diff HEAD --summary`
- `git diff --cached --name-only | grep -E '\.(lock|tsbuildinfo|log|cache)$|\.DS_Store|HANDOFF|CHECKPOINT'` (must be empty)
- For each staged .sh/.py/.mjs file: `git ls-files --stage` (must show 100755)
- For each staged file: `git log --oneline -5 -- <file>` (look for revert risk)

This is a pre-PUSH gate, not pre-DEMO. Failures → YELLOW, demo can still go.

Step 4.2 — Visual sweep on demo path:
- Re-screenshot at 1280×800 and 1920×1080.
- DOM-search for: Lorem, Ipsum, TODO, "Coming soon", Placeholder, xxx, "[object Object]", undefined, null.
- Find any `<img>` with naturalWidth=0.
- Spot-check fonts against `directives/font_consistency.md`.
- Empty states that look like bugs.

Each finding → row in AUDIT_HOUR4.md table (Module / Issue / Severity / Fix-before-demo).
Severity: BLOCKER (visible to user, breaks credibility) or POLISH (post-demo).

Step 4.3 — Account hygiene:
- Logged-in account is William's real identity, not test@test.com.
- Notifications panel clean.
- Activity feeds show real items.

Step 4.4 — Browser hygiene:
- One tab only.
- No bookmarks bar.
- No extensions visible.
- DevTools closed.
- OS-level do-not-disturb on.

Step 4.5 — Write AUDIT_HOUR4.md from template.

### Final — DEMO_GO_NOGO.md

Roll up the four hour-files. Single verdict block, hour summary table, GO checklist
or NO-GO blocker list, recommended next demo window if NO-GO.

### Stop conditions

Jules STOPS and writes `.agent/BLOCKED.md` (which step / exact command / exact output
/ one-line guess of cause / "Awaiting William") if:
- Any preflight fails.
- Any Hour 1 step fails per the rules.
- Any RED on a demo-path module in Hour 2 without William's choice on file.
- Any fix attempt produces a novel error not in ERROR_LEDGER.
- Any tool call exceeds 10 minutes with no progress.
- Any step requires a judgment call this runbook does not specify.

### Token economy notes for the Jules executor

- Use Bash with absolute paths.
- Don't open files >200 lines unless a step says to.
- Don't re-derive repo facts — they're listed at the top.
- Don't write commentary into the artifact files beyond the templates.
- Don't add extras after the final GO. Stop.
