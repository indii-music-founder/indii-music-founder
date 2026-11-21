# Boardroom Completion Runbook

**Status:** active · **Written:** 2026-11-21 · **Owner:** the repository owner (solo founder) · **Executors:** any coding agent (Claude, Codex, Gemini/Antigravity, or a human)

This runbook finishes the Boardroom modernization that started in
[`boardroom-modernization-plan-2026-11-19.md`](boardroom-modernization-plan-2026-11-19.md).
The earlier plan holds the audit and the background. This document is the
step-by-step instructions for every remaining item. Work it from top to
bottom. Each **Work Package (WP)** is a bounded unit; delivery follows the current repository policy and owner authorization.
bottom. Each **Work Package (WP)** is one branch and one pull request.

When the WPs are published, hand the branch list and evidence back. For this
project the owner has asked Claude to do the approval review described in
[§6](#6-handback-for-approval); that review is owner-requested, not a general
repository gate.

---

## 0. What is already done (do not redo)

Merged to `main`, structural tests only, still 🟡 PARTIAL until live acceptance:

| V4 ID | What | Where |
|---|---|---|
| 1624 | Paid workspace judge no longer fires per token | `faaf33b` |
| 1625 | Shared z-index scale; cost modal and toasts above Boardroom | `faaf33b` (`core/zLayers.ts`) |
| 1627 | UI 60s stream timer removed | `faaf33b` |
| 1628 | Handoff reject ends the router wait | `faaf33b` (`a2a/handoffApproval.ts`) |
| 1629 | Emergency Abort stops the run | `faaf33b` |
| 1654 | `return await` keeps timeout/Stop attached | `faaf33b` |
| 1656 | Run timeout no longer overwrites seat 0's answer | `8ffaeb3` |
| 1657 | Orphaned dispatch lease released after reload | `d10395d` |
| 1663 | Agents see newest gallery assets | #959 |
| 1664 | Each discussion seat gets its own context | #961 (Codex) |
| 1665 | Seat timeout aborts and drops late tokens | `8ffaeb3` |
| 1666 / 1667 | Stop ends the swarm loop; Stop shows "Stopped by user" | `faaf33b` |
| 1626, 1630–1633, 1635, 1637, 1638, 1640–1646, 1690 | Codex 2026-11-20 partial repairs | see each V4 entry's status line |

Open as PRs (merge before starting a WP that touches the same files):

| PR | Branch | V4 / spec item |
|---|---|---|
| #964 | `claude/boardroom-fold-layout` | Spec L1: table folds to left-edge tab |
| #965 | `claude/boardroom-real-stop` | Spec W4/D2: one real Stop mission |
| #966 | `claude/determined-johnson-3xr573` | 1662: free instant greeting |
| — | `claude/plan-branch-delivery` | Plan doc: branch delivery wording |

---

## 1. Rules every executor follows

These are not optional. Breaking one blocks approval in §6.

### 1.1 Delivery and ownership
1. Read `.agent/workflows/branch-safety.md` and follow its current delivery policy.
2. Use mainline delivery unless the owner explicitly authorizes a task branch or integration batch. The owner has authorized the integration queue to combine compatible incoming branches and merge verified batches through Entire.
3. Keep origin on Entire. Never force-push or rewrite main. Inspect CI for the exact delivered SHA.
4. Check incoming branches and active work before claiming overlapping files; preserve other agents' changes.
5. Record the agent name and date in the WP's **Claimed by** line when work starts.
### 1.1 Branches, never `main`
1. Read [`.agent/workflows/branch-safety.md`](../../.agent/workflows/branch-safety.md) first.
2. `git fetch origin && git checkout -B <agent>/<wp-slug> origin/main` for each WP. `<agent>` is `claude`, `codex` or `antigravity`.
3. Push only that branch: `git push -u origin HEAD:refs/heads/<agent>/<wp-slug>`.
4. Never push to `main`, never force-push, never rewrite history. If the base moves, `git merge origin/main` into your branch.
5. Publishing the validated branch completes delivery, per `branch-safety.md`. Open a pull request only when the owner asks for one, and then open it ready (never draft). Do not request reviews unless the owner asks. The owner merges.
6. Before starting a WP, check open PRs and branches for anyone already on the same files (§5 conflict map). If someone is, pick a different WP.
7. Write your agent name and date in the WP's **Claimed by** line in this file in your first commit, so others see it.

### 1.2 Machine setup (first time per machine)
```bash
npm ci --cache ./.npm-cache-isolated-$$ --onnxruntime-node-install-cuda=skip
```
- `--onnxruntime-node-install-cuda=skip` is required; without it `onnxruntime-node` tries a GPU download that 404s.
- Use `NODE_OPTIONS=--max-old-space-size=8192` for `npm run typecheck`, `npm run typecheck:renderer` and `git commit` (the pre-commit hook runs the full typecheck and runs out of memory at the default heap). Never bypass the hook with `--no-verify`.

### 1.3 Test first, every time
For each item:
1. Check `.agent/skills/error_memory/ERROR_LEDGER.md` for the pattern.
2. Write a test that **fails on current code** and shows the bug. Run it and keep the failure output.
3. Fix the code. Run the same test and show it passing.
4. Never weaken, skip or delete an existing test to get green. If an existing test encoded the old (buggy) behavior, change its expectation and say why in the commit.

### 1.4 Local gate before every push
```bash
npx vitest run packages/renderer/src/modules/boardroom packages/renderer/src/services/agent <other touched dirs>
NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck:renderer
npx eslint <touched files>          # 0 errors; do not add warnings
node scripts/check-test-quality.js
node scripts/validate-issue-ledger.mjs origin/main
git diff --check
```
Also scan for hard-coded infra IDs (CLAUDE.md §11):
`grep -rnE "endpoints/[0-9]{6,}|locations/(us|us-central1|global)/|projects/[0-9]{6,}" packages/renderer/src` — the only allowed hit is `services/agent/fine-tuned-endpoints.generated.ts`.

### 1.5 Known red CI that is not yours
These e2e specs fail on `main` today and will be red on every PR until WP0 lands:
- shard 2: `e2e/detroit-techno-onboarding.spec.ts:120`, `e2e/distribution-workflow.spec.ts:178`, `e2e/indii-macro-flywheel.spec.ts:61`
- shard 3: `e2e/mcp-a2a-routing.spec.ts:22`, `e2e/mcp-boardroom-collaboration.spec.ts:22`

If only these fail, note it once (on the PR if there is one, otherwise in the handback) with the spec list and a link to a base run showing the same failure. Any **other** red check is yours to fix.

The **Entire Gates** check and **Codex review** can fail on billing/quota ("Promotional credit has run out", "usage limits"). That is not a code failure; note it once.

### 1.6 Ledger rules (`.agent/test_ledger/OPEN_ISSUES_V4.md`)
- One V4 entry per finding. New findings take the next free ID (currently **ISSUE-1691**; run `node scripts/issue-ledger-inventory.mjs` to confirm).
- When a repair lands on your branch, set the entry's status to
  `🟡 PARTIAL — code repair on branch <branch> (<date>); awaiting CI and live acceptance`
  and add a `- **Repair note:**` line: what changed, which test proves it.
- **Never write the word "fixed", "completed" or "closed" inside a PARTIAL status** — the validator treats those as resolved and demands closure evidence.
- Only mark `✅ FIXED` after live signed-in acceptance (§4), with a line
  `- **Closure evidence:** commit <sha>, CI https://github.com/indii-music-founder/indii-music-founder/actions/runs/<id>, live check <date> <what was observed>`.
- Never edit `OPEN_ISSUES_V3.md` or anything in `archive/`.

### 1.7 Honesty rules
- Unit tests are structural checks. Never write "works", "verified" or "done" for a user path that was not exercised in the real app with a real account (`.agent/REAL_USER_AUTHENTICITY.md`).
- In every PR body, list exactly what was and was not verified.
- If a new regression pattern appears, add it to `ERROR_LEDGER.md` in the same PR.

---

## 2. Work packages

Order matters where noted. Each WP lists: **IDs**, **Files**, **Steps**, **Tests to write first**, **Done when**.
File paths are relative to `packages/renderer/src/` unless they start with `packages/` or `e2e/`.
Line numbers in V4 entries are from 2026-11-19 and may have drifted; always locate code with `grep -n` on the named function or string.

### WP0 — Make CI green again (do this first)
**Claimed by:** —
**IDs:** new ticket ISSUE-1691 "Five e2e specs fail on main" + 1686
**Files:** `e2e/detroit-techno-onboarding.spec.ts`, `e2e/distribution-workflow.spec.ts`, `e2e/indii-macro-flywheel.spec.ts`, `e2e/mcp-a2a-routing.spec.ts`, `e2e/mcp-boardroom-collaboration.spec.ts`, `e2e/fixtures/*`, `e2e/boardroom-debug.spec.ts`, `e2e/boardroom_test.spec.ts`
**Steps:**
1. Create ISSUE-1691 in V4 listing the five specs and the base run (`actions/runs/44874990405`).
2. Run each locally: `npx playwright test <spec> --project=chromium --trace off`. Read the failure (screenshot + error context in `test-results/`).
3. For each, decide: is the **app** broken (fix the app) or did the **spec/mock** drift from the current UI or contract (fix the spec/mock, following `e2e/fixtures/aiStream.ts` helpers)? Write the reason in the V4 entry. The flywheel spec waits for text `Cyberpunk Digital Vinyl Run` after "New Drop"; check whether that UI still exists.
4. MCP specs need an MCP SSE server. Either start the real local server in the spec's `beforeAll` (see `packages/mcp-server-local`) or, if that cannot run in CI, mark the spec with a **clear skip reason that names the missing service** and record that in V4. Do not silently skip.
5. 1686: `e2e/boardroom-debug.spec.ts` has no `expect`; `e2e/boardroom_test.spec.ts` only checks `body` visible. Either turn them into real assertions or delete them, and say which in the PR. Deleting a spec is allowed only for these two, because they assert nothing.
**Done when:** the five specs pass in CI (or carry a named-service skip recorded in V4), and the two empty specs are real or gone.

### WP1 — Render speed: one memoized message row
**Claimed by:** —
**IDs:** 1626 (remaining: memoized full row), 1643 (remaining: AppShell mount test)
**Files:** `modules/boardroom/components/BoardroomConversationPanel.tsx` (+ new `BoardroomMessageRow.tsx`), `core/AppShell.tsx`, tests beside each.
**Steps:**
1. Extract the per-message JSX inside the `.map` in `BoardroomConversationPanel` into `BoardroomMessageRow`, wrapped in plain `React.memo` (default shallow compare). Do **not** write a custom comparator: the row also renders from `msg.metadata` (persona measurement, updated by `AgentService.applyCompletedResponse` after finalization) and from the panel-wide `agentsResponding` flag (the user row's waiting animation). Pass every render input as a prop: the message object itself (the store replaces it immutably when it changes), `agentsResponding`, and callbacks.
2. Pass row callbacks via `useCallback` so props stay stable.
3. In `BoardroomModule.tsx`, stop subscribing to the whole `agentHistory` where only its length or the last message is needed (grep `agentHistory` in `BoardroomModule.tsx`, `BoardroomJourney.tsx`, `BoardroomRightRail.tsx`).
**Tests first:**
- Render 30 messages, then update the text of the last one 10 times. Count renders of row 0 with a render-counter mock; it must stay at 1. (Codex added `BoardroomConversationPanel.performance.test.tsx`; extend it.)
- A metadata-only update to a finished agent message (persona measurement status) re-renders that row's response actions.
- When the last streaming message finishes, the user row's waiting animation goes away.
- AppShell: with `conversationMode: 'direct'`, the Boardroom lazy import is not requested; with `'boardroom'` it is.
**Done when:** both tests pass; no visible change.

### WP2 — Orchestration latency (AgentService; run alone, see §5)
**Claimed by:** —
**IDs:** 1658 (O5), 1659 (O6), 1661 (O8), 1675 (O22)
**Files:** `services/agent/AgentService.ts`, `services/agent/BaseAgent.ts`, `services/agent/components/AgentExecutor.ts`, `services/agent/CapabilitySnapshotService.ts`, `services/agent/components/AgentOrchestrator.ts`, `config/typesafeJudgments.ts`, `services/intelligence/FirebaseIntelligenceService.ts`, `services/agent/PersonaAgentResponseService.ts`
**Steps:**
1. **1658** — per-seat preflight:
   - Cache `loadCapabilitySnapshot()` per turn: create it once in `handleBoardroomSwarmFlow` and pass it via context; `BaseAgent` uses the passed one if present.
   - In `AgentExecutor.execute`, do not `await TraceService.startTrace` before running; start it and attach the promise (failures logged, not thrown).
   - `MembershipService.checkBudget`: call once per turn, not per loop iteration.
   - In `FirebaseIntelligenceService` stream setup, run `prepareBackendRequestHeaders` in parallel with `checkQuota/checkRateLimit` (`Promise.all`), keeping the reservation after both.
2. **1659** — persona finalizer: move `applyCompletedResponse` out of the chunk barrier. The seat's raw text goes into `accumulatedContext` immediately; finalization runs after and updates the message when done. Do not block the next chunk on it.
3. **1661** — history summarization: measure first. Add a test that a Boardroom swarm turn does not call `SummaryService.summarize` on the critical path when seats discard it. If seats use `context.chatHistory` and not the summary, skip building the summary for Boardroom discussion turns. Write the measurement in V4.
4. **1675** — run `evaluateSecurityGate` once per turn and pass the result down. Route `judgeBoardroomIntent`, `judgeSpecialistAgentRoute`, `judgeOrchestrationComplexity` through the existing `invokeTypesafeJudge` path with a ~3s timeout and the run's `AbortSignal`; on timeout use the existing fallback.
**Tests first:** in `AgentService.boardroom-capability-intent.test.ts`, a 3-seat turn calls `getCapabilitySnapshot` once (not 3x); `startTrace` that never resolves does not stop the seat; a slow persona finalizer does not delay chunk 2's start; security gate called once; a hung judge resolves to fallback after the timeout.
**Done when:** all pass; record before/after call counts in each V4 entry.

### WP3 — Persistence contention (after WP2, same files)
**Claimed by:** —
**IDs:** 1655 (O2), 1674 (O21)
**Files:** `core/store/slices/agent/agentSessionSlice.ts`, `services/agent/SessionService.ts`, `services/agent/AgentFirebaseConnector.ts`, `core/components/chat/ChatMessage.tsx`, `modules/mobile-remote/components/AgentChat.tsx`, `packages/firebase/firestore.indexes.json`, `packages/firebase/firestore.rules`
**Steps:**
1. **1655** — streaming updates: stop touching the session document's `updatedAt` on every token. Text deltas write only the message doc (plain `updateDoc`, no `getDocFromServer` + transaction). Bump session `updatedAt` once when a message finishes. Coalesce across messages per session (one write queue per session, latest text wins).
2. **1674** — `boardroom_messages` is write-only. Move ratings to the session message (`ChatMessage.tsx` rating handler, `AgentChat.tsx`). Then remove the `AgentFirebaseConnector.syncMessage` writes, its index entry and its rules block. Run `npm run test:rules` (or the firestore rules test file) to confirm nothing else reads it.
**Tests first:** 3 seats streaming 20 tokens each produce at most 3 session-doc writes; a rating in Direct mode succeeds without `boardroom_messages`.
**Done when:** tests pass; rules tests pass; V4 notes the write counts.
**Caution:** rules/index changes deploy with Firebase. Say so in the PR so the owner deploys rules deliberately.

### WP4 — Run correctness (after WP3, same files)
**Claimed by:** —
**IDs:** 1660 (O7), 1669 (O16), 1668 (O15), 1670 (O17), 1671 (O18), 1672 (O19), 1677 (O24), 1685 (O32)
**Files:** `services/agent/AgentService.ts`, `services/agent/orchestration/BoardroomActionPlan.ts`, `services/agent/components/AgentOrchestrator.ts`, `core/store/slices/boardroomSlice.ts`, `services/agent/HistoryManager.ts`, `services/agent/BaseAgent.ts`
**Steps:**
1. **1660** — action steps: in the `executor.execute` progress callback inside `handleBoardroomRequestFlow`, handle `token` events (append to the step message). On completion, keep the agent's prose and append the receipt below it (`formatBoardroomReceipt`). The coordinator summary message lists step outcomes in one line each, not full receipts again.
2. **1669** — session switch: every message add/update in `handleBoardroomSwarmFlow` and the action flow uses `runSessionId` (`appendRunMessage`, and a session-scoped update helper that reads `sessions[runSessionId]`), never `agentHistory`/active session.
3. **1668** — `addActiveAgent` must not re-normalize and re-seat the Conductor. Action routing must not permanently seat routed agents; use a per-turn list.
4. **1670** — give `determineAgent`, `determineFanOut`, complexity and graph decomposition the last model proposal when the user's text is a confirmation (`go ahead`, `yes`, `do it`). Step agents get the turn being confirmed even with 4+ seats.
5. **1671** — map worker IDs to their department head (`getDepartmentOf` in `services/agent/departments.ts`) before building steps; if a step still has no owner, fall back to a single-step plan instead of throwing.
6. **1672** — tool actions from the annotator must honor `forcedAgentId` and not re-enter the Boardroom chat path; `[System Note]` messages must not trigger a turn.
7. **1677** — add the "Indii is coordinating N participants" message only when `activeAgents.length > 0` after the dispatch plan.
8. **1685** — label history lines by agent name (`[Marketing Director]:`) instead of `Assistant:` in `BaseAgent` history assembly and `HistoryManager`.
**Tests first:** one test per item in `AgentService.boardroom-capability-intent.test.ts` or `__tests__/BoardroomSoloRoutingAndLoopRecovery.test.ts`. Example for 1669: start a 2-seat run on session A, switch active session to B mid-run, assert all seat messages land in A and none in B.
**Done when:** all pass; V4 updated per item.

### WP5 — Prompt safety and rate limiting
**Claimed by:** —
**IDs:** 1673 (O20), 1676 (O23), 1678 (O25)
**Files:** `services/agent/AgentService.ts` (asset block), `services/agent/governance/ModelArmor.ts`, `hooks/useBoardroomContextHandshake.ts`, `core/store/slices/boardroomSlice.ts`, `services/agent/governance/AgentCommunicationPolicy.ts`, `services/agent/BaseAgent.ts`, `services/intelligence/TokenUsageService.ts`
**Steps:**
1. **1673** — cap referenced assets (e.g., 12) in the slice; fence the `[BOARDROOM REFERENCED ASSETS]` block as `DATA, NOT INSTRUCTIONS`; ModelArmor scans only the user's utterance, not pinned third-party text. Confirm removals already persist (Codex did dedupe/removal under 1633).
2. **1676** — the swarm prompt must not tell agents to delegate (policy returns `BOARDROOM_NOTES_ONLY`). Reword to "note what another department should do; the Conductor seats them". Delete the unreachable Boardroom checks in `BaseAgent` after confirming with tests they never run.
3. **1678** — replace read-then-`setDoc` in the minute bucket with `setDoc(ref, { count: increment(1) }, { merge: true })`.
**Tests first:** a pinned page containing "jailbreak" does not block a seat; 20 pins keep only the cap; prompt text contains no "delegate"; two parallel rate-limit calls end at count 2.
**Done when:** pass; V4 updated.

### WP6 — Electron browser hardening
**Claimed by:** —
**IDs:** 1679 (O26), 1680 (O27), 1681 (O28), 1645 (remaining: tab retention)
**Files:** `packages/main/src/handlers/boardroomBrowser.ts` (+ test), `packages/main/src/utils/network-security.ts`, `modules/boardroom/components/BoardroomBrowserView.tsx`, `modules/boardroom/components/BoardroomWorkspacePane.tsx`
**Steps:**
1. **1679** — add a per-host verdict cache (TTL ~60s) in front of `validateSafeUrlAsync`'s DNS lookup.
2. **1680** — renderer calls `detach` on unmount; `detach` calls `this.view.webContents.close()` and removes its listeners.
3. **1681** — zod-validate `openExternal` input (https only, no private hosts, same check as `navigate`); run `captureContext` in an isolated world and length/type-check the result in main.
4. **1645** — confirm the workspace keeps visited tabs mounted (`visitedTabs`), so switching tabs does not re-attach the native view; add a test if missing.
**Tests first:** in `boardroomBrowser.test.ts`: two requests to one host trigger one DNS lookup; detach closes webContents; `openExternal('http://127.0.0.1')` is refused.
**Done when:** pass; note "live Electron acceptance pending" in V4.

### WP7 — Layout spec remainder (after #964 merges)
**Claimed by:** —
**IDs:** spec L2–L5 (track as new ISSUE-1692 "Boardroom rail and drawer spec remainder"), 1636 (U14)
**Files:** `modules/boardroom/BoardroomModule.tsx`, `modules/boardroom/components/BoardroomRightRail.tsx`, `modules/boardroom/components/MobileParticipantDrawer.tsx`, tests beside each.
**Steps:**
1. **L2/L3** — on desktop split layout, make the discussion a drawer that slides over the workspace from the right (left of the 56px rail) instead of a docked `w-[28%]` column, keeping the existing docked option behind the header toggle. Drafts stay because the pane stays mounted.
2. **L4** — in the rail's agent panel (grep `Seat`/`Unseat` in `BoardroomRightRail.tsx`) add **Solo** (`soloAgent`) and **Grant browser control** (only when the hosted browser is open; reuse `shareWithMission` logic via a store action). Keep select, seat, solo and grant as four separate buttons.
3. **L5** — handoff highlight: when a new `a2aMessages` entry arrives, highlight the receiving agent's avatar for ~2s (CSS `motion-safe:` only). Add a per-state icon next to each avatar (working, needs approval, idle) with matching `aria-label`. Reduced motion shows static icons only.
4. **1636 / phones** — `MobileParticipantDrawer` shows the same status (working/approval/idle) and latest action per agent; the workspace opens as a full-screen sheet on phones instead of a squeezed column; Living Plans and approvals get a phone entry point (header team button).
**Tests first:** split layout renders discussion as a dialog/drawer; Solo button calls `soloAgent`; a new a2a message adds a highlight class to the receiver; phone drawer lists status text.
**Done when:** pass. Browser screenshots at 1440×900 and 390×844 come only from a genuinely signed-in session (`.agent/REAL_USER_AUTHENTICITY.md`). If no genuine credentials are available, request the official sign-in flow from the owner or record "browser evidence unavailable" in the handback. Never inject, mock or bypass authentication to get a screenshot.

### WP8 — Typed workspace actions (biggest; split into 8a–8c)
**Claimed by:** —
**IDs:** spec D1, W2, W3, D2 (track as new ISSUE-1693), 1690 (remaining)
**Files:** new `services/agent/boardroomWorkspaceActions.ts`, `services/agent/tools/CoreTools.ts`, `services/agent/tools/NavigationTools.ts`, `services/agent/boardroomBrowserResearch.ts`, `modules/boardroom/components/BoardroomWorkbenchView.tsx`, `modules/boardroom/components/BoardroomModulePreview.tsx`, `core/store/slices/boardroomSlice.ts`
**8a — the interface (D1):**
1. Define `BoardroomWorkspaceAction = { missionId; stepId; agentId; target: 'browser'|'studio'|'workbench'|'feed'; operation: string; payload }` and `BoardroomWorkspaceResult = { ok: boolean; observed: string; error?: string }`.
2. One `executeWorkspaceAction(action)` dispatcher that calls the existing tab-opening store actions (`openBoardroomBrowser`, `openBoardroomModulePreview`, `openBoardroomWorkbench`, `openBoardroomAgentFeed`) and returns what the UI actually shows (verify state after the call, never assume).
3. Migrate `BoardroomBrowserAssignment` and the Image Studio draft tool (`CoreTools.ts`) to emit this action.
**8b — Studio and Workbench (W2, W3):** add typed operations for the Studio controls the artist uses (start with Creative: set prompt, aspect ratio, open Image Studio, all shown inside the Boardroom preview). Workbench: add a `split-sheet` target kind and loading/failure/empty states for the media list (artifacts already have them).
**8c — single controller (D2):** a store field `boardroomControl: { surface; holder: 'artist' | agentId; grantId; revision }`. Taking control bumps `revision` and rejects queued agent actions whose `revision` is old. Show "You have control" / "<agent name> has control" + **Take control** on Studio and Workbench the way the hosted browser does. Stop mission (from #965) resets control to the artist.
**Tests first:** dispatcher returns `ok:false` with a reason when the tab did not open; a stale-revision action is rejected after takeover; split-sheet target opens the right item.
**Done when:** pass for each sub-PR.

### WP9 — Living Plans tracker
**Claimed by:** —
**IDs:** 1639 (U17)
**Files:** `modules/boardroom/components/LivingPlansTracker.tsx`, `services/agent/LivingPlanService.ts`, `core/store/slices/` (the living-plan slice), `core/components/chat/PlanCard.tsx`
**Steps:** replace the unbounded `getDocs` on open with a store-backed `onSnapshot` listener with `limit(20)`; pass `isLoading` to `PlanCard` so Approve cannot run `resumeActivePlan` twice; confirm Cancel with `ConfirmDialog.call`; remove the `setTimeout(0)` hacks and the duplicated empty-state line.
**Tests first:** double-clicking Approve calls `resumeActivePlan` once; Cancel without confirming does nothing.

### WP10 — Accessibility
**Claimed by:** —
**IDs:** 1634 (U11), 1653 (U29), 1652 (U28), 1651 (remaining: unreachable `AnimatePresence` exit)
**Files:** `modules/boardroom/components/ParticipantSelector.tsx`, `BoardroomAssetStrip.tsx`, `BoardroomRightRail.tsx`, `BoardroomWorkspacePane.tsx`, `BoardroomWorkbenchView.tsx`, `BoardroomModulePreview.tsx`, `BoardroomModule.tsx`, and any file with `text-[7px]`/`text-[8px]`.
**Steps:**
1. **1634** — the seat is a container `div`, not `role="button"`. The main toggle is its own `<button>`; Solo and sub-agent are sibling buttons. Add `group-focus-within:opacity-100` so focused hidden buttons appear. Same fix for the asset strip tile + Export.
2. **1653** — rail roster chips become `<button>`s with readable names; workspace and workbench tablists get `role="tabpanel"`, `aria-controls` and arrow-key navigation; the module menu either gets arrow keys or drops `role="menu"`.
3. **1652** — raise all `text-[7px]`/`text-[8px]` to at least `text-[10px]`.
4. **1651** — move `AnimatePresence` so the Boardroom exit animation can run (render `null` inside it instead of returning before it).
**Tests first:** Enter on Solo calls `soloAgent` and not `toggleAgent`; ArrowRight moves tab focus; a hygiene test fails on `text-[7px]`/`text-[8px]` in `modules/boardroom` (extend `boardroomClassHygiene.test.ts`).
**Done when:** pass; run axe (`e2e` accessibility helper) on the Boardroom if available and attach the result.

### WP11 — Visual system
**Claimed by:** —
**IDs:** 1647 (U23), 1648 (U24)
**Files:** `modules/boardroom/**` (styling only), `services/agent/AgentVisualIdentity.ts`
**Steps:**
1. **1647** — table seats take color and icon from `resolveAgentVisualIdentity` (delete the separate map in `ParticipantSelector.tsx` `AVAILABLE_AGENTS` styling). Replace hard-coded blue-black hex (`bg-[#060608]`, `bg-[#0d0d12]`, `bg-[#12161f]`, `bg-slate-900`, `bg-zinc-950` …) with the design tokens in `index.css` (`bg-bg-dark` and the surface tokens). Read `.jules/palette.md` and `directives/font_consistency.md` first.
2. **1648** — prefix every `animate-ping|pulse|bounce|spin` in `modules/boardroom` with `motion-safe:`; replace `transition-all` on Motion-animated or draggable elements with `transition-colors`.
**Tests first:** extend `boardroomClassHygiene.test.ts`: fails on bare `animate-(ping|pulse|bounce|spin)` and on `bg-[#0` hex backgrounds in `modules/boardroom`.
**Done when:** pass; before/after screenshots at 1440×900 and 390×844 from a genuinely signed-in session, or "browser evidence unavailable" recorded (same rule as WP7).

### WP12 — Cleanup (last; touches many files)
**Claimed by:** —
**IDs:** 1649 (U25), 1650 (U26), 1682 (O29), 1683 (O30), 1684 (O31), dead files (new ISSUE-1694)
**Steps:**
1. **Dead files** — `MessageFeed.tsx`, `BoardroomEmptyState.tsx` (imported only by `BoardroomModule.test.tsx`) and `HarnessDecisionDigest.tsx` (no importers). Re-check with `git grep` right before deleting; remove their tests in `BoardroomModule.test.tsx`. Also unused: `useBoardroomContextHandshake()` hook export (keep `publishBoardroomContextUpdate`), `boardroomBrowserHistory` (written, never read), `HARNESS_IMPLEMENTATION_STATUS` (test-only). Not `indii-` assets, not under `.agent/skills|workflows` or `execution/`, so CLAUDE.md §7 allows removal, but list each in the PR.
2. **1649** — one `isSafeExternalAssetUrl` (asset strip + workbench), one mission catalog (journey + starter cards; reconcile the DDEX mission's seats), seating presets go through slice actions, dock tabs defined once, portal URLs defined once.
3. **1650 / 1682** — split `BoardroomBrowserView` (toolbar, bookmarks, frame-blocked card, reader), and extract `createProgressHandler(resId)` and `buildAssetManifest()` from `AgentService.ts` to replace the copy-pasted handlers. Behavior must not change; existing tests are the guard.
4. **1683** — remove identical ternary branches (`isBoardroomMode ? X : X`), type the `(m: any)` callbacks, name the magic numbers (`CHUNK_SIZE`, timeouts, clip length), replace `console.error` in `core/store/index.ts` with `logger`.
5. **1684** — remove or wire the meta-harness placeholder (`runs: []`), fix "domain(s)" pluralization and the `execution_ready` vs `escalate` mismatch in `BoardroomMetaHarnessService.ts`.
**Done when:** all existing Boardroom and agent suites pass unchanged; ESLint warning count does not rise.

---

## 3. Merge order for the owner

Merge one PR at a time and let the Firebase deploy for `main` finish before the next merge (each push to `main` cancels the in-progress deploy).

1. #964, #965, #966, then the plan-doc branch
2. WP0 (green CI)
3. WP1, WP6, WP9 (independent)
4. WP2 → WP3 → WP4 → WP5 (same `AgentService.ts`; strictly in this order)
5. WP7 → WP10 → WP11 (same Boardroom UI files; in this order)
6. WP8a → 8b → 8c
7. WP12 last

---

## 4. Final live acceptance (owner or a delegated agent with the owner's real account)

Per `.agent/REAL_USER_AUTHENTICITY.md`: real account, ordinary Chrome, deployed app, no mocks.

1. Open the Boardroom. Confirm the table is folded, the "Table" edge tab opens it, the rail shows the Conductor first.
2. Say "hi" — instant greeting, no swarm (watch the Feed: no steps).
3. Ask the Conductor to have one specialist research a supplied public page and pin a reference. Watch the rail: the working ring, the handoff highlight.
4. Have Creative use that reference to prepare artwork in Studio inside the Boardroom.
5. Take control mid-draft, edit the prompt, hand control back. Confirm the agent's queued action did not land.
6. Open the result in Workbench. Export it.
7. Press Stop during a queued step. Confirm the run ends, approvals clear, control returns, the message says "Stopped by user".
8. Reload mid-turn, then send a message: it must go through (no 15-minute lock).
9. Repeat 1–3 on a phone (390px) and with reduced motion on.
10. Desktop (Electron): open the native browser view, switch tabs, close the Boardroom; confirm no hidden page keeps running.

For each V4 item exercised, add the closure evidence line (§1.6) and set ✅ FIXED. Anything that did not work becomes a new V4 entry.

---

## 5. Conflict map

| File | WPs | Rule |
|---|---|---|
| `services/agent/AgentService.ts` | WP2, WP3, WP4, WP5, WP12 | One at a time, in order |
| `modules/boardroom/BoardroomModule.tsx` | WP1, WP7, WP10, WP12 | WP1 first, then WP7 → WP10 → WP12 |
| `modules/boardroom/components/BoardroomRightRail.tsx` | WP7, WP10, WP11 | In that order |
| `modules/boardroom/components/ParticipantSelector.tsx` | WP10, WP11, WP12 | In that order |
| `core/store/slices/boardroomSlice.ts` | WP4, WP5, WP8 | Merge base before starting |
| `packages/firebase/firestore.rules` | WP3 only | Owner deploys rules deliberately |

If two agents need the same file, the later one waits for the earlier PR to merge, then `git merge origin/main` into its branch.

---

## 6. Handback for approval

When a WP's branch is published, add a row here (in the WP's branch) and hand the list back to the owner, who passes it to Claude for the owner-requested review:

| WP | Branch | PR (if the owner asked for one) | Head SHA | Local gate output attached | V4 IDs updated | Screenshots (UI WPs) | Not verified |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Claude's approval review checks, per WP:
1. Every listed V4 item has a test that failed before and passes after (output in the PR).
2. No test was weakened, skipped or deleted without the reason §1.3/WP0 allows.
3. The diff touches only that WP's files; no unrelated changes.
4. No PARTIAL status contains "fixed/completed/closed"; no FIXED status lacks closure evidence.
5. No hard-coded infra IDs; no `window.confirm/alert/prompt`; no new ESLint errors.
6. Claims in the handback (and any PR body) match what was actually run.
7. No browser evidence was produced with mocked, injected or bypassed authentication.
8. Where CI ran, it is red only on the §1.5 list (until WP0).

Claude will reply per WP: **Approved**, or **Changes needed** with the exact file and line.
