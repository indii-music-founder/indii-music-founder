# Checkpoint — Browser QA sweep of the Studio shell (2026-07-22)

**Branch:** main · **Agent:** Claude · **Base:** `57d235f00` → 5 commits added this session

## What this session was

A `/qa` pass: test the app like a user, fix what's broken at the source, commit each fix
atomically, re-verify, log everything to the canonical ledger.

## Done this session (verified — evidence in ISSUE-1185..1190)

- **`dev:e2e-mock` target added** (`6c657dcc`) — `package.json` + `.claude/launch.json`, port 4242.
  Reuses the project's **existing** `VITE_E2E=true VITE_FIREBASE_E2E_MOCK=true` flags (the same ones
  `playwright.config.ts` already uses for its webServer). This is how you QA the authenticated shell
  on a machine with no `.env`, without touching `.env` (CLAUDE.md §4 forbids that).
- **ISSUE-1185 FIXED** (`d6df7df3`) — `PlatformCard.tsx:143` spread `key` into `React.Fragment` via
  `{...({ key: f.label } as any)}`. React drops a spread key, so all seven feature rows rendered
  keyless. Now `key={f.key}` directly. Verified: fresh console buffer → 0 warnings (was 1 per render).
- **ISSUE-1186 FIXED** (`3006ca3f`) — cookie banner's fixed wrapper is a full-width 1280×250 strip;
  ~600px of it is transparent padding that still ate clicks, killing the sidebar and chat input until
  consent was answered. Fixed with `pointer-events-none` / `pointer-events-auto`.
  Verified via `elementFromPoint` at (150,500), (1100,500), (640,500).
- **ISSUE-1187..1190 opened** (`fa189882`) — see ledger.
- **ERROR_LEDGER** — two new entries at the top: the spread-`key` anti-pattern and the
  full-bleed-overlay pointer-events trap, both with grep-able audit rules.

## Open, needs a founder decision or a follow-up

| Issue | Sev | One-liner |
|---|---|---|
| ISSUE-1187 | 🟠 | Cookie banner sits on top of all four onboarding career-path cards. Three fix shapes written up; **recommendation: gate `bottom-20` on the phone breakpoint** — it exists to clear `MobileTabBar`, which is phone-only, so it is simply wrong on desktop. |
| ISSUE-1188 | 🟠 | `BoardroomModule.tsx:158` hides the whole agent roster behind `{!isAnyPhone && …}`, but the panel still says "Select agents and submit a brief." Phone users are locked to 1 default agent with no control and no explanation. |
| ISSUE-1189 | 🟡 | No `<h1>` anywhere; two `<h2>`s both read "indii"; no `aria-current` on ~28 nav buttons; "Return to HQ" is 94×16 (WCAG 2.2 minimum is 24×24). |
| ISSUE-1190 | 🔵 | `React.Fragment key=` fails typecheck repo-wide → forces `@ts-expect-error`. This is what made ISSUE-1185 possible. Root cause unresolved; three ruled-out theories recorded so nobody re-treads them. |

## Verified-OK — do NOT re-audit these

- `DevPortWarning` (red "Web-Only Mode" badge) is correctly `import.meta.env.DEV`-gated
  (`packages/renderer/src/core/App.tsx:53`) — cannot ship to production.
- Cookie consent **behaviour** is correct: reject writes
  `indii_cookie_consent={essential:true, analytics:false, errorTracking:false, marketing:false, timestamp, version:1}`
  and does not reappear after reload.
- **0** untyped `<button>` inside a `<form>` across all 15 form-bearing `.tsx` files. "Forgot Password?"
  is explicitly `type="button"`. This pattern is clean.
- Empty sign-in submit → native HTML5 validation, no crash.
- No horizontal overflow at 375×812.
- All 12 swept modules render without an error boundary, with honest empty states
  ("No active projects", "No distributors connected", "No notes", "Awaiting discussion…").
  No fabricated data seen anywhere — consistent with the no-mock-data rule.

## Scope limit — read this before trusting the pass

This ran on **mock auth**, not real Firebase. There is no `.env` in this sandbox. Mock auth covers
rendering, routing, layout, and client logic. It does **NOT** cover real Firestore reads/writes, real
Storage, or real Functions. Nothing here is live backend verification — that gap is already
ISSUE-1184 and was not re-opened.

## NEXT SESSION — start here

1. **ISSUE-1187** needs your pick of fix shape (1 modal-gate / 2 bottom-bar / 3 defer) before anyone codes it.
2. **ISSUE-1188 part 2** is a cheap standalone win: make the Boardroom empty-state copy responsive so
   it stops instructing mobile users to do something the viewport cannot do. Ship that even if part 1
   (a mobile seating sheet) is deferred.
3. **ISSUE-1190** is worth an hour before a third agent hits the same wall. Start by flipping
   `strict: true` on the renderer in a scratch branch to test the `IsExactlyAny` theory.

## Dirty-tree note (multi-agent)

A **second agent was working in this worktree concurrently** during this session. Not mine, not
touched, not committed by me:
`.agent/HANDOFF_STATE.md`, `.gitignore` (venv entries), `AGENT_BRIDGE.md`,
`packages/shared/src/index.ts` + `dist/**`, four new `packages/shared/src/schemas/*.ts` (+ tests:
`sessionEditPlan`, `audioRecipe`, `approvalReceipt`, `derivativeHandoff`),
`.agent/artifacts/qa_report_latest.json`, `.agent/artifacts/qa_screenshots/**`,
`.agent/artifacts/run_auto_qa.js`, `docs/flowcharts/session_breakdown_pipeline.md`.
They also appended ISSUE-1191..1192 to the ledger and flipped ISSUE-1175/1176/1177 to 🟡 PARTIAL
**on top of** my committed entries — my ISSUE-1185..1190 are intact (verified against `HEAD`).
Leave their work alone unless William says otherwise.
