# Playwright Failure Investigation Handoff

## Status
**INVESTIGATION COMPLETE — NO CODE CHANGES YET.** Findings ready for next agent to act on. User has approved diagnosis but explicitly held implementation.

**Date:** 2026-04-28
**Source data:** `playwright-report/data/*.md` (115 failure reports from run on 2026-04-28 00:30)

---

## TL;DR for the next agent

Of ~115 failing Playwright tests, **111 are environmental** (dev server crashed mid-run, every subsequent test hit `ERR_CONNECTION_REFUSED`) and **4 are real bugs**. Do NOT start patching tests one by one — the dev-server crash will mask whether your fixes worked. Re-run with logging first.

---

## Root cause #1 — Dev server died mid-run (111 of 115 failures)

**Evidence**: 111 of 115 `.md` failure reports contain:

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4242/
```

This explains the 130–160ms duration cluster the user pasted — every test failed instantly because TCP connection to localhost:4242 was refused.

The `webServer` block in `playwright.config.ts` is supposed to keep the dev server alive:

```ts
webServer: {
  command: 'npm run dev',
  url: 'http://127.0.0.1:4242',
  timeout: 60_000,
  reuseExistingServer: !CI,
}
```

But four tests *did* navigate successfully (with real assertion failures, see below), proving the server was up briefly then died. `dev_server.log` and `e2e-error.log` are both empty — no captured stderr. We cannot identify the crash trigger without re-running with stdout piped.

## Root cause #2 — Real assertion failures (4 of 115)

### 2a. `e2e/creative-prompt-builder.spec.ts:75` and `:98` — `direct-view-btn` never appears

```
TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
  - waiting for locator('[data-testid="direct-view-btn"]')
```

Page snapshot shows the global sidebar rendered (Brand Manager, Creative Director, Video Producer, Maestro etc.) but the **Creative Studio module body never mounted** despite `page.goto('/creative')`. Duration 32.3s = 30s `waitForSelector` + ~2s nav.

**Hypothesis**: app uses store-driven imperative module switching (Zustand `activeModule`), not React Router routes. Hitting `/creative` updates the URL bar but does not flip the module. The selector lives in `packages/renderer/src/modules/creative/components/CreativeNavbar.tsx:54`, which only renders when the Creative module is active.

**If true, every module spec is fragile** — `creative.spec.ts`, `distribution-workflow.spec.ts`, `finance-workflow.spec.ts`, `legal.spec.ts`, `video.spec.ts`, etc. all rely on `page.goto('/<module>')` to switch modules. The Creative tests were just the only ones that ran far enough to expose it.

**Confirm by reading**: `packages/renderer/src/App.tsx` (or whatever the shell is) and the sidebar's nav-click handler. Look for `setActiveModule(...)` vs `<Route path="...">`.

### 2b. `e2e/a11y.spec.ts:28` and `:59` — Real WCAG AA contrast violations

axe-core flagged the sidebar empty-state label:

- `class="px-4 py-2 text-gray-500"` ("No projects" empty state)
- foreground `#6a7282` on background `#0e1014` = **3.93:1 contrast** (fails WCAG AA 4.5:1)

Genuine UI bug. Located in the sidebar's Projects section empty state.

---

## Suspected (not confirmed)

`e2e/creative-prompt-builder.spec.ts:179` expects `[data-testid="improve-prompt-btn"]`. Phase 1 explore reported the source button in `PromptBuilder.tsx` (~line 172, "Improve with AI") has no explicit testid. **Verify in source before patching either side.**

---

## Files referenced

- `playwright.config.ts` — webServer config, port 4242, single chromium worker, 60s test timeout
- `e2e/creative-prompt-builder.spec.ts` — failing prompt builder tests (lines 75, 98, 150, 179, 209, 245, 276)
- `e2e/fixtures/auth.ts` — 638-line auth/Firestore mock fixture
- `e2e/a11y.spec.ts` — failing color-contrast tests (lines 28, 59)
- `packages/renderer/src/modules/creative/components/CreativeNavbar.tsx:54` — owns `[data-testid="direct-view-btn"]`
- `packages/renderer/src/modules/creative/CreativeStudio.tsx` — module entry, lazy-loads `CreativePanel`
- `packages/renderer/src/modules/creative/components/PromptBuilder.tsx:146` — owns `Prompt Engineering` header
- `playwright-report/data/*.md` — 115 archived failure reports
- `dev_server.log`, `e2e-error.log` — both empty; no captured dev-server stderr

---

## Proposed fix order (ordered, do not skip step 1)

### Fix 1 — Re-run with dev-server diagnostics (MUST do first)

Until we know whether the dev-server crash reproduces, every other fix is unverifiable.

```bash
cd /Volumes/X\ SSD\ 2025/Users/narrowchannel/Desktop/indiiOS-Clean
lsof -ti:4242 | xargs kill -9 2>/dev/null
# Terminal 1 — capture dev server output
npm run dev 2>&1 | tee dev_server.log
# Terminal 2 — sanity check single spec
npx playwright test e2e/navigation.spec.ts --project=chromium --reporter=line
# If green, run full suite
npx playwright test --project=chromium
# Watch dev_server.log for crash output during the run
```

Outcomes:
- (a) Dev server stable → 111 phantom failures gone, 4 real bugs remain. Proceed to Fix 2 + 3.
- (b) Crash reproduces → grep `dev_server.log` for the panic; fix the trigger before anything else.
- (c) Specific test triggers crash → bisect by spec; that test gets priority.

### Fix 2 — `direct-view-btn` / module navigation

Two paths depending on what the app shell does:

- **If route-based**: fix the router so `/creative` mounts `CreativeStudio`.
- **If store-based**: tests must dispatch the store action (`page.evaluate(() => window.__store.setActiveModule('creative'))`) or click the sidebar entry. Add `gotoModule(page, 'creative')` helper in `e2e/fixtures/` and migrate all module specs.

Confirm which by reading `packages/renderer/src/App.tsx` and sidebar nav handlers.

### Fix 3 — Sidebar empty-state contrast

Bump `text-gray-500` (#6a7282) on the sidebar "No projects" label to `text-gray-400` (#99a1af, ~6.5:1 against `#0e1014`) or higher. Audit other `text-gray-500` usages on dark backgrounds while there.

### Fix 4 — Verify `improve-prompt-btn` testid

Read `PromptBuilder.tsx` "Improve with AI" button. Either:

- Add `data-testid="improve-prompt-btn"` to source, OR
- Update test to `getByRole('button', { name: /improve with ai/i })`.

### Fix 5 — Make webServer crashes louder

Add stdout/stderr piping to `playwright.config.ts` `webServer` block so future runs capture dev-server output to `dev_server.log` automatically. 10× faster diagnostics next time.

---

## Verification (after fixes)

1. `npm run dev` boots cleanly, dev_server.log shows no errors at idle
2. `npx playwright test e2e/navigation.spec.ts --project=chromium` passes
3. `npx playwright test e2e/creative-prompt-builder.spec.ts --project=chromium --headed` — visually confirm Creative module mounts and prompt builder toggles
4. `npx playwright test e2e/a11y.spec.ts --project=chromium` — contrast violations resolved
5. Full suite ≥ 90% pass rate
6. `playwright-report/index.html` review — only intentional skips remain

---

## Provenance

Investigation by Claude Opus 4.7 in plan mode on 2026-04-28. Source-of-truth diagnostic data: `playwright-report/data/*.md` (snapshot of last failed run). Plan file (Claude-private mirror): `~/.claude/plans/creative-prompt-builder-spec-ts-prompt-b-purring-sutton.md`. Both files contain the same findings — this handoff is the canonical version for the team.
