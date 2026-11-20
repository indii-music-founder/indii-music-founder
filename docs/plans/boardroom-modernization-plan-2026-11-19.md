# Boardroom Modernization Plan (living, agent-neutral) — 2026-11-19

> For Claude, Gemini, Codex, Droid, Jules, Antigravity. Read `CLAUDE.md` / `AGENTS.md` first.
> **Ledger:** findings below become `ISSUE-1624+` in `.agent/test_ledger/OPEN_ISSUES_V4.md` (V4 is active; V3 is sealed).
> **Claimed by:** Codex — Phase 3 (Faster), 2026-11-20
> **Section 5 — Current State:** Phases 0-1 done. Phase 2 complete in code: `faaf33b` (ISSUE-1624/1625/1627/1628/1629/1654/1666/1667), `8ffaeb3` (ISSUE-1656, 1665), and Phase 2c (ISSUE-1657 per-tab lease recovery). All remain PARTIAL pending live signed-in acceptance. Phase 3 local work underway: ISSUE-1638, ISSUE-1641, ISSUE-1642, and ISSUE-1643 have local fixes; focused regression coverage is complete for all except ISSUE-1643. Boardroom component suites, the Jev judgment suite, and renderer typecheck pass locally. Remote CI is handled by the team and was not monitored here. Known gap on 1657: a closed (not reloaded) tab still waits out the 15-min server TTL; a server heartbeat/shorter TTL would close it.
> Source plan text follows; ignore references to "this session" or session-branch tooling.

# Plan: Boardroom modernization, OPEN_ISSUES_V4, and a plan shared with all agents

## Context

The founder wants the **Boardroom** (the full-screen multi-agent workspace) to be faster, cleaner, more modern and more reliable, and wants it done first. Every finding goes into a new master ledger, `OPEN_ISSUES_V4.md`, and the plan must be readable by **Gemini and Codex** as well as Claude.

Decisions already made:
- **V3 → V4:** seal V3 the same way V2 was sealed (2026-08-02). V3 is copied as-is into the archive, the V3 file becomes a retirement notice, the 106 V3 items that aren't closed are copied into V4, and new findings start at **ISSUE-1624**. V3's highest ID is 1623, and nothing in the repo uses 1624 or higher.
- **Scope:** write the ledger and the plan, then make the fixes in phases.
- **Design:** keep the current layout (orbital table, chat panel, workspace pane, right rail). Fix speed and bugs, remove dead code, and move styling onto design tokens, with motion and accessibility in line. No redesign.
- **Delivery:** `main` directly, following `.agent/workflows/branch-safety.md`. Each phase is one validated commit pushed with `git push origin HEAD:main`, and CI is checked for that exact SHA using the GitHub MCP `actions_list`/`get_job_logs`. If branch protection rejects a direct push, stop and ask before falling back to `claude/determined-johnson-3xr573` with a draft PR.

Machine state:
- `node_modules` is empty, so this runs the `/walk` "drive to prime" step.
- Node is v22 (the repo wants 24 or later, but `engine-strict=false`).
- The mem0, firebase, gcloud and sentry MCP servers failed to connect, so the error-memory check uses `.agent/skills/error_memory/ERROR_LEDGER.md` only.
- The clone is shallow.

---

## Phase 0: Prime the machine (no commit)

```
git fetch origin main && git checkout -B main origin/main
node scripts/assert-canonical-repo.mjs
npm ci --cache ./.npm-cache-isolated-$$        # CLAUDE.md §9 isolated cache
```
Baseline before any edits: `npm run typecheck:renderer` and `npx vitest run packages/renderer/src/modules/boardroom packages/renderer/src/core/store/slices/boardroomSlice.test.ts`. Record any failures that already exist so they aren't blamed on this work.

---

## Phase 1: Ledger V4 and the shared plan (commit 1: docs and ledger tooling)

### 1a. Seal V3 and create V4

1. Copy `.agent/test_ledger/OPEN_ISSUES_V3.md` byte for byte to `.agent/test_ledger/archive/OPEN_ISSUES_LEGACY_V3_2026-11-19.md`.
2. Generate `.agent/test_ledger/OPEN_ISSUES_V4.md` with a one-off script kept in the scratchpad, not committed. The script imports `parseIssueLedger` (`scripts/issue-ledger-integrity.mjs`) and the status classifier in `scripts/issue-ledger-inventory.mjs`, and selects exactly the **106 nonterminal** sections. Every section is copied **verbatim**, including any unnumbered notes that trail it, so IDs, titles and cross-references stay valid.
3. V4 layout copies the V3 header style:
   - `# Open Issues — Real-Life Test Findings (V4, ACTIVE)`
   - The "written by test agents / consumed by fix agents" block.
   - **Last updated**, **Delivery: `main`**.
   - A **Ledger protocol (V4)** paragraph:
     - Same entry format: `### ISSUE-NNNN: <title>`, then `- **Status:**`, Severity, Module, Evidence, Impact, Fix, Acceptance.
     - Same status vocabulary: 🔴 OPEN / 🟡 PARTIAL / ✅ FIXED / 🟢 WONTFIX.
     - Append-only. V3 is sealed in `archive/`. New IDs start at ISSUE-1624.
   - A **Reconciliation snapshot** with the output of `node scripts/issue-ledger-inventory.mjs`.
   - `## Active Unresolved Issues (Migrated from V3)`: the verbatim copies.
   - `## Session 2026-11-19 — Boardroom Modernization Audit`: new entries ISSUE-1624 onwards (see "Findings" below), each with Status, Severity, Module, Evidence (file:line), Impact, Fix and Acceptance.
     - The open V3 Boardroom notes that had no ID are re-ticketed with a `- **Re-ticketed from:**` line, as V2→V3 did. These are: the Conductor intent-uncertainty incident and the Conductor/Arcjet owner-continuity note, both still waiting for signed-in acceptance; and the `mcp-a2a-routing`/`mcp-boardroom-collaboration` e2e specs, which need a real local MCP SSE server.
4. Replace the contents of `OPEN_ISSUES_V3.md` with a retirement notice, using the V2 file as the template. Repoint the V2 notice so it says V4 is the active ledger.

### 1b. Ledger tooling, so CI accepts the migration

- **New `scripts/issue-ledger-config.mjs`**, the one place paths are defined:
  - `ACTIVE_LEDGER = '.agent/test_ledger/OPEN_ISSUES_V4.md'`
  - `RETIRED = [{ path: '…/OPEN_ISSUES_V3.md', archive: '…/archive/OPEN_ISSUES_LEGACY_V3_2026-11-19.md' }]`
  - `SEALED_ARCHIVES` = the three `archive/` files
- **`scripts/validate-issue-ledger.mjs`** (keep the CLI and its `--staged` flag):
  - The active ledger is checked with `validateIssueLedger(base ?? '', candidate)`. A file missing at the base is treated as empty; existence is checked with `git cat-file -e rev:path` before calling `git show`.
  - For each retired ledger whose base still has findings, the candidate **archive** must keep all of them: `validateIssueLedger(baseRetired, candidateArchive)` must return no errors. This lets V3 turn into a notice only when its archive is complete.
  - Any sealed archive that exists at the base must be byte-identical in the candidate. Otherwise fail with "sealed archive modified".
  - Duplicate checks are done per file, so copying entries forward from V3 doesn't trip `duplicate finding added`.
- **`scripts/issue-ledger-inventory.mjs`**: read `ACTIVE_LEDGER`.
- **`scripts/issue-ledger-integrity.test.mjs`**: change the fixture paths (L48, L50) to come from the config. Add CLI cases:
  - The first V4 commit, with no V4 at the base, passes.
  - Retiring V3 without an archive fails.
  - Editing a sealed archive fails.
  - Migrated copies that exist in both the archive and V4 pass.
- **`.github/workflows/issue-ledger-integrity.yml`** (L6, L14): change the path triggers to `.agent/test_ledger/OPEN_ISSUES_V*.md`, `.agent/test_ledger/archive/**` and `scripts/issue-ledger-config.mjs`.
- **`.husky/pre-commit:76`**: run the validator whenever any `OPEN_ISSUES_V*.md` or `archive/` ledger file is staged.
- **`execution/mega_browser_gauntlet.py:8`**: point it at V4.

### 1c. Instruction docs → V4

Only change docs that tell agents where to write. Leave historical records alone.
- **CLAUDE.md §8** (L570, L575): point to V4, and add a sentence saying V3 was sealed on 2026-11-19 and lives in `archive/`. Then copy CLAUDE.md verbatim into `GEMINI.md`, `CODEX.md`, `DROID.md`, `JULES.md` and `ANTIGRAVITY.md`, keeping each file's own header line, as the mirroring rule requires.
- `OPEN_ISSUES.md` (L5, L11, L53).
- `.agent/workflows/*.md`, the body lines that say V3: `issue`, `real`, `mega-test`, `issue-sweep`, `mega`, `finish`, `abcd`, `factory`, `hunter`, `b`, `c`, `get-git`, `evolas-gauntlet`, `a`, `d`, `WIIL-skill`.
  - In `sweep.md`, add V4 and the new archive to the never-sweep list.
  - If any workflow frontmatter changes, run `npm run capabilities:generate` so that `.agent/capabilities/catalog.json` stays valid.
- `.agent/NEXT_AGENT_HANDOFF.md`, `docs/RELEASE_CHECKLIST.md:92`, `docs/ISSUE_COMPLETION_PLAN.md:5`, `docs/POD_CHECKOUT_AND_WEBHOOK_FIXES_PLAN.md:137`, `.agent/skills/session-breakdown-delivery/SKILL.md:10`.
- **Leave alone:** `docs/audits/*`, `.agent/checkpoints/*`, `ERROR_LEDGER.md` history, `INDII_DEEP_DIVE_REPORT.md`, and other historical citations. Line numbers that point into V3 still resolve in the byte-identical archive.

### 1c-bis. Keep V3 fixing uninterrupted (founder's next phase)

- The 106 open V3 items move to V4 verbatim, so fix agents continue from V4 with the same IDs.
- Put a "V3 moved to V4 on 2026-11-19, edit V4 only" banner at the top of the V3 notice.
- Note in the commit message and V4 header that open PRs or branches editing V3 must move their edits to V4.
- Do not touch any V3 item's status in this work except via the normal closure-evidence rule.

### 1d. Make the plan available to every agent

- Each phase in the shared plan is an agent-neutral work card: V4 IDs, files, failing test first, verify commands, and a `Claimed by:` line so Gemini, Codex, Droid, Jules and Claude don't collide.

- Commit this plan as **`docs/plans/boardroom-modernization-plan-2026-11-19.md`**. It is a living plan, written so any agent can use it:
  - No Claude-only tool names.
  - Each phase lists its V4 issue IDs, the files it touches, and its verification commands.
  - Section 5, "Current State", is updated at the end of each phase. This follows `docs/CHAT_IMAGE_INTERACTION_PLAN.md`.
- Add a row to the **Key Files Quick Reference** table in CLAUDE.md, copied to all five mirrors (Gemini reads `GEMINI.md`, Codex reads `CODEX.md`): "Living plan — Boardroom modernization; update Current State before ending any session that touches Boardroom."
- Add the same pointer to **`AGENTS.md`**, which Codex and most CLI agents read natively.

**Verify Phase 1:**
- `node --test scripts/issue-ledger-integrity.test.mjs scripts/issue-ledger-inventory.test.mjs`
- `node scripts/validate-issue-ledger.mjs origin/main`
- `node scripts/issue-ledger-inventory.mjs`: about 106 nonterminal plus the new entries, 0 ambiguous.
- `cmp` the archive against `git show origin/main:.agent/test_ledger/OPEN_ISSUES_V3.md`.
- `node scripts/validate-mainline-workflows.js` and `npm run validate:capabilities`.
- `diff <(tail -n +5 CLAUDE.md) <(tail -n +5 GEMINI.md)` and the same for each other mirror: no output.
- Push, then check the **Docs and Policy Gate** and **Issue ledger integrity** runs for that SHA.

---

## Findings → V4 entries (ISSUE-1624 onwards)

Severity and evidence come from the read-only audit. The critical items were checked against the source by hand. Paths are relative to `packages/renderer/src/`.

### UI layer (`modules/boardroom/**`, `boardroomSlice.ts`, `useBoardroomContextHandshake.ts`)

**CRITICAL**
- **U1.** A paid `typesafeJudge` Cloud Function call fires for **every streamed token**. `BoardroomWorkspacePane.tsx:61-73` has an effect on `[agentHistory]`, and `judgeBoardroomWorkspaceRecommendation` (`config/typesafeJudgments.ts:11388`) has no cache or debounce. Meanwhile `AgentService.ts:780` rewrites `agentHistory` on each token.
- **U2.** The Boardroom root is `z-[99999]` (`BoardroomModule.tsx:125`). That hides `CostWarningModal` (`z-50`), so image-generation cost approval waits forever (`ImageGenerationService.ts:390-398`). It also hides every toast (`ToastContext.tsx:148`, `z-[100]`). Seat tooltips are forced to `z-[100]` as well (`ParticipantSelector.tsx:481`).

**HIGH**
- **U3.** The whole Boardroom re-renders on every token:
  - It subscribes to `agentHistory` at `BoardroomModule.tsx:57`.
  - There is no `React.memo` anywhere.
  - Markdown `components` and `remarkPlugins` are recreated on every render.
  - `agentsResponding` is computed inside `.map`, so the work grows with the square of the message count (`BoardroomConversationPanel.tsx:280-408`).
  - The module preview re-renders the whole department module.
  - `BoardroomJourney` subscribes to the whole history but only needs its length.
- **U4.** The "stale stream" cleanup sets `isStreaming:false` and **persists** it after 60s with no tokens (`BoardroomConversationPanel.tsx:189-204`). The service allows 300–600s (`AgentService.ts:514`), so long tool calls show as finished partway through.
- **U5.** Rejecting an agent-to-agent handoff does nothing. `SwarmCollaborationFeed.tsx:27-29` writes the same `approved:false` the message started with, and the router keeps waiting the full 300s (`a2a/A2ARouter.ts:236-244`). The only approval UI is behind the desktop-only rail.
- **U6.** "Emergency Abort" is a no-op on the web (`BoardroomAgentFeedView.tsx:67-70`), even though the store has `agentAbortController`. The kill switch can't be reset.

**MEDIUM: correctness**
- **U7.** The conductor count and the conductor's state disagree. Seat UI and prompt blocking contradict each other (`departments.ts:107`, `boardroomSlice.ts:104-107`, `PromptArea.tsx:189`).
- **U8.** Worker seat buttons do nothing (`ParticipantSelector.tsx:535` → the slice rejects non-heads).
- **U9.** Only 9 of the 23 heads have table seats. Missions, starter cards and the browser seat other heads that never appear. The multi-ring `calculateParticipantSeatLayout` exists but is never used.
- **U10.** Referenced assets have several problems:
  - No de-duplication.
  - A stale-snapshot race between `core/store/index.ts:219-231` and `useBoardroomContextHandshake.ts:102-110`.
  - The handshake runs outside Boardroom mode.
  - "Clear All" is undone by the next generation.
  - There is no way to remove a single asset.
  - Pin ids use `Date.now()`.
- **U11.** Nested interactive controls. The seat `role=button` div swallows Enter and Space for the Solo and sub-agent buttons inside it (`ParticipantSelector.tsx:359-367,425,445`). The same pattern appears in `BoardroomAssetStrip.tsx:113-149`.
- **U13.** Workbench problems:
  - A failed `readArtifact` leaves "Loading document..." forever.
  - Changing the target is ignored on the Artifacts sub-tab.
  - Thumbnails load eagerly.
- **U14.** Mobile:
  - The workspace pane squeezes in next to the chat.
  - There is no mobile way into Living Plans or approvals.
  - The drawer has no seat controls, and the copy is stale.
  - The desktop header "Seat agents" button is a no-op.
- **U15.** In Electron, `setBounds` is sent over IPC on every captured scroll event, including each scroll triggered by a token (`BoardroomBrowserView.tsx:225`). The native view also covers the lightbox and popovers.
- **U16.** Both `BoardroomJourney.tsx:158-173` and `BoardroomStarterCards.tsx:106-135` call `judgeBoardroomExecutiveIntent` on the same input. Starter cards also overwrite the user's draft.
- **U17.** `LivingPlansTracker`:
  - Runs an unbounded `getDocs` on every open.
  - Approve can be pressed twice, which runs `resumeActivePlan` twice.
  - Cancel has no confirm.
  - Has `setTimeout(0)` hacks.
  - Has a duplicated empty-state line.
- **U18.** Hand-rolled modals have no dialog semantics, Escape or focus trap: `LivingPlansTracker`, `SwarmCollaborationFeed` and the asset lightbox.
- **U19.** Attachment data URIs are rebuilt on every render (`BoardroomConversationPanel.tsx:416`).
- **U20.** `PromptArea` remounts when the first message arrives (`BoardroomConversationPanel.tsx:239` vs `:513`), losing focus and in-flight state.
- **U21.** `AppShell.tsx:692-694` mounts `BoardroomModule` all the time, so its chunk (react-markdown and all the views) loads at startup and it subscribes to the store in every mode.
- **U30.** The `ModuleErrorBoundary` in `BoardroomModulePreview.tsx:235` has no `key`, so one crashed module blocks every other module.
- **U31.** In the browser view, page loading and Pin share one `isLoading` flag. IPC promises are unhandled, and switching tabs remounts every view.

**MEDIUM: consistency and trust**
- **U22.** Hard-coded "live" telemetry: "Gemini 3 Pro", "2,000,000 tokens", "Optimal", a governance popover that says "Active", and "ACTIVE MONITOR".
- **U23.** Two separate agent colour and icon systems: `ParticipantSelector.tsx:53-153` vs `AgentVisualIdentity.ts`. There is also blue-black hex hard-coded throughout, which contradicts the warm palette in `index.css:51`.
- **U24.** 16 `animate-*` uses have no `motion-safe:` guard, and `transition-all` fights Motion transforms when dragging.

**LOW**
- **U25.** Duplicated code:
  - URL guard
  - export and send-to-Studio handlers
  - mission and starter-card data, which has drifted
  - seating presets that go around the slice actions
  - dock buttons defined twice
  - portal URLs
- **U26.** Oversized components: `BoardroomBrowserView` 769 lines, `ParticipantSelector` 564, `BoardroomConversationPanel` 542.
- **U27.** Classes that do nothing: `animate-fadeIn`, `py-0.2`, a literal `"false"` class, and an `AnimatePresence` that can never run exit animations.
- **U28.** Unreadable `text-[7px]` and `text-[8px]`.
- **U29.** Accessibility gaps:
  - Rail chips are `<span onClick>`.
  - Tablists have no `tabpanel` or arrow keys.
  - `role="menu"` has no keyboard navigation.
- **Dead code:**
  - Files: `MessageFeed.tsx`, `BoardroomEmptyState.tsx`, `HarnessDecisionDigest.tsx`.
  - The `useBoardroomContextHandshake()` hook.
  - Actions: `setBoardroomWorkbenchTarget`, `openBoardroomModulePreview`, `openBoardroomAgentFeed`, `clearA2AMessages`.
  - Never read: `boardroomBrowserHistory`.
  - The `onOpenLivingPlans` prop on `BoardroomTable`.
  - Unused imports.
  - Per the CLAUDE.md §7 asset rule, the founder is asked before any `indii-` or skill asset is removed. None of these are.
- **Tests:**
  - A test that can't fail: `BoardroomModule.test.tsx:115-119`.
  - Tests of dead code: `:204-232`.
  - No tests at all for `BoardroomWorkbenchView`, `BoardroomModulePreview`, `BoardroomAgentFeedView`, `LivingPlansTracker` or `SwarmCollaborationFeed`.

### Orchestration and latency layer

Paths below: `AS` = `packages/renderer/src/services/agent/AgentService.ts`. Found by read-only audit 2026-11-19; not yet re-verified by running code.

**HIGH**
- **O1.** Non-streaming `generateContent` never enforces its 120s timeout or Stop, and never voids its cost reservation: missing `await` at `services/intelligence/FirebaseIntelligenceService.ts:755-757`, so the `finally` at `:864-871` clears the timer immediately.
- **O2.** Every streamed message update reads and transacts on the shared session doc (`core/store/slices/agent/agentSessionSlice.ts:598-628`, `SessionService.ts:213-235`); 3-9 parallel seats contend on one document, causing retries and unsaved messages.
- **O3.** The 300s overall timeout (`AS:514`, `:582-588`) overwrites the Conductor's finished reply (seat 0 reuses `responseId`, `AS:1522`).
- **O4.** After reload or failed release, the dispatch lease (15 min TTL, `packages/firebase/src/functions/billing/enforceOperationCost.ts:218,1301-1324`) blocks every discussion turn (`AS:1461`, release is fire-and-forget at `AS:1731`).
- **O5.** Per-seat pre-flight is ~6 serial uncached round trips: capability snapshot callable (`CapabilitySnapshotService.ts:48`, `BaseAgent.ts:1163`), awaited `startTrace` (`AgentExecutor.ts:88`), `checkBudget` per loop (`BaseAgent.ts:1309`), quota then headers then reservation (`FirebaseIntelligenceService.ts:1000-1031`).
- **O6.** Persona finalizer adds 2 LLM calls per seat inside the chunk barrier (`AS:1634`, `PersonaResponseService.ts:171-185`); seats 4-9 wait and the client limiter throttles.
- **O7.** Action steps never stream tokens and drop agent prose from receipts (`AS:1360-1386`, `BoardroomActionPlan.ts:206`).
- **O8.** History summarization blocks every send but agents discard it (`HistoryManager.ts:105-118`, `BaseAgent.ts:1120-1143`).

**MEDIUM**
- **O9.** Trivial "hi" runs the full paid swarm; Boardroom instant greeting is dead (`AS:1232`, `AS:349-354`, `AS:838`).
- **O10.** Asset manifest uses `slice(-20)` / `[length-1]` on a newest-first list, so agents see the oldest (`AS:1499`, `BaseAgent.ts:1355`, `creativeHistorySlice.ts:196`).
- **O11.** Parallel seats share and mutate one context (`AS:1437`, `AgentExecutor.ts:96-98`).
- **O12.** Per-seat 300s timeout neither aborts work nor stops late writes; timer leaks (`AS:1609-1613`).
- **O13.** Stop doesn't break the swarm chunk loop (`AS:1517`); `startTrace` runs before the abort check (`AgentExecutor.ts:88,102`).
- **O14.** Stop during intent/planning shows a false "request failed" because abort reason is a string (`agentUISlice.ts:160`, `AS:624`).
- **O15.** Solo-specialist mode re-seats the Conductor via `normalizeBoardroomAgentIds` (`AS:1297`, `boardroomSlice.ts:133`, `departments.ts:101-108`).
- **O16.** Session switch mid-run misplaces messages and drops thoughts (`AS:1453,1525,1362`; use `appendRunMessage(runSessionId)`).
- **O17.** Planner gets no conversation history, so "go ahead" routes on literal text (`AgentOrchestrator.ts:152-344`).
- **O18.** Routing to a worker agent throws a user-facing error (`BoardroomActionPlan.ts:102-120`).
- **O19.** Tool actions in Boardroom trigger two full paid turns (`AS:2228,2233`, `AS:738-752`).
- **O20.** Referenced assets: unbounded, unfenced, removals revert, can trip ModelArmor on every seat (`store/index.ts:219-231`, `ModelArmor.ts:51,146-159`, `AS:1470-1484`).
- **O21.** Boardroom messages double-written to write-only `boardroom_messages` (`AgentFirebaseConnector.ts:33-94`); ratings fail outside Boardroom (`ChatMessage.tsx:232`); index `firestore.indexes.json:403-414` serves nothing.
- **O22.** Security gate runs 3-4x per turn; judge callables have no timeout/abort (`AgentOrchestrator.ts:63,103,305,404`; `typesafeJudgments.ts:733-785`).
- **O23.** Swarm prompt tells agents to delegate but policy returns `BOARDROOM_NOTES_ONLY`; related checks are dead (`AS:1565`, `AgentCommunicationPolicy.ts:57`, `BaseAgent.ts:407-536`).
- **O24.** Confusing plan message on capacity/active-turn (`AS:1442-1466`).
- **O25.** Client rate limiter read-then-write race (`TokenUsageService.ts:282-305`).

**Electron (`packages/main/src/handlers/boardroomBrowser.ts`)**
- **O26.** Uncached DNS check per subresource with 5s cutoff (`:53-74`).
- **O27.** Native view never destroyed; hidden page keeps running (`:293-306`; renderer `BoardroomBrowserView.tsx:226-235`).
- **O28.** `openExternal` lacks zod/private-host check; `captureContext` runs in main world, result unchecked (`:279-325`).

**LOW**
- **O29.** Giant functions and copy-pasted progress handlers: `handleBoardroomSwarmFlow` 344 lines, `sendMessage` 300, `executeFlow` 264, `BaseAgent._executeInternal` ~1250.
- **O30.** Identical ternary branches (`AS:507-511` etc.), `any`, magic numbers, `console.error` in `store/index.ts:229`.
- **O31.** Dead exports/placeholder data: `HARNESS_IMPLEMENTATION_STATUS`, meta-harness always `runs: []`.
- **O32.** Agents cannot tell which seat said what (all labeled "Assistant:").
- **O33.** `e2e/boardroom-debug.spec.ts` has no expects; `e2e/boardroom_test.spec.ts` only checks body visible; no Stop/timeout/lease/session-switch specs.


---

## Fix phases (one commit and CI cycle each, all on `main`)

Every phase:
1. Check `ERROR_LEDGER.md` for the pattern first.
2. Write a failing test first for each regression (`.agent/skills/tdd`).
3. Make the fix.
4. Run focused vitest, `npm run typecheck:renderer`, `npx eslint --max-warnings=0 <touched files>`, `node scripts/check-test-quality.js` and `git diff --check`.
5. Run the full `/plat` build gate before the push: `npm run typecheck && npm run lint && npm test -- --run && npm run build`.
6. Push with `git push origin HEAD:main`, then inspect CI for that exact SHA.
7. Update the V4 statuses. During a phase commit, use `🟡 PARTIAL — code repair landed; awaiting exact-SHA CI`. **Never use the word "fixed" in a PARTIAL status**, because the validator's regex treats it as resolved. Move an entry to `✅ FIXED` with a `- **Closure evidence:** commit <sha> … CI https://github.com/…/actions/runs/<id>` line only after CI is green. Do this in the next phase's commit or the final closeout commit. Entries whose acceptance is a real user path (generation completes, approvals round-trip) stay `🟡 PARTIAL — live signed-in acceptance pending`, per `.agent/REAL_USER_AUTHENTICITY.md`.
8. Add any new regression patterns to `ERROR_LEDGER.md`.
9. Update "Current State" in the shared plan.

| Phase | Theme | Items |
|---|---|---|
| 2 | Stop cost leaks, hangs and false state | U1, U2 (one z-index token scale: overlay < modal < toast < tooltip; raise CostWarningModal and Toast above the Boardroom), U4 (tie it to the service timeout or abort, don't persist from the UI), U5 (tri-state approval; the router exits on reject; a pending badge), U6 (call `agentAbortController.abort()` on web, plus a reset), and any CRITICAL or HIGH orchestration items |
| 3 | Faster | U3 (a memoized `BoardroomMessageRow`, hoisted markdown config, `agentHistory.length` selectors), U19, U20, U21 (mount only in Boardroom mode), U16 (one shared intent hook), U15 (rAF throttle and same-bounds skip), lazy thumbnails, and the orchestration latency items |
| 4 | Correct seating and assets | U7, U8, U9 (render seats from the normalized roster using `calculateParticipantSeatLayout`), U10 (de-duplication and a batch action in the slice, a fresh `getState()`, a Boardroom-mode gate, dismissed ids, per-asset remove), U13, U17, U30, U31 |
| 5 | Cleaner | Dead-code removal, U25 (one `isSafeExternalAssetUrl`, one mission catalog, data-driven dock tabs), U26 (extract `BoardroomMessageRow` and the browser toolbar and reader), U27, and repair the tests that can't fail or that test dead code |
| 6 | Modern and accessible | U23 (seat styles from `resolveAgentVisualIdentity`, `bg-bg-dark` and surface tokens), U24, U11, U18 (a shared `BoardroomSheet` with `useFocusTrap` and Escape, the pattern from `MobileParticipantDrawer.tsx:22-34`), U28, U29, U22 (real data or remove), U14 (mobile workspace sheet and entry points) |
| 7 | Closeout | V4 statuses with closure evidence, shared-plan Current State, `.agent/HANDOFF_STATE.md`, `bash .claude/scripts/checkpoint.sh` |

Existing code to reuse:
- `normalizeBoardroomAgentIds`, `listHeadIds`, `isValidHeadId` (`services/agent/departments.ts`)
- `calculateParticipantSeatLayout` (`ParticipantSelector.tsx:174`)
- `resolveAgentVisualIdentity` (`services/agent/AgentVisualIdentity.ts`)
- `useFocusTrap` and `useGlobalShortcut` (used in `MobileParticipantDrawer.tsx`)
- `ConfirmDialog.call` (react-call)
- `agentAbortController` (store)
- `PlanCard`'s `isLoading` prop (`core/components/chat/PlanCard.tsx:11`)

## Verification (end to end)

- **Unit and structural:** focused Boardroom suites, plus new tests per item. Examples:
  - The judge is called once per completed reply, not per token.
  - A 61s gap with no tokens does not end the stream.
  - Reject ends the router wait.
  - Web abort calls `abort()`.
  - Assets are de-duplicated.
  - Keyboard Solo works.
  - The z-index ordering holds.
- **Gate:** `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`.
- **Browser:** `e2e/boardroom-swarm.spec.ts` plus the boardroom e2e specs with `--trace off`. These are structural only (mock auth), and that is how they will be described.
- **Visual:** Playwright screenshots at 1440×900 and 390×844 of the Boardroom in its empty and populated states, before and after.
- **Not claimed:** live signed-in acceptance on `https://indii.music/`. That needs the founder's real account, so those V4 entries stay PARTIAL and say so.
