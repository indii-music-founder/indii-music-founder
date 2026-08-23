# Remote Studio Executor — Architecture & Implementation Plan

**Status:** PLANNED — not started. No code has been written against this plan.
**Provenance:** Founder-authored directive (drafted with a second agent, 2026-08-22), adopted as the plan of record for renderer-independence of the remote executor. Annotated with repository evidence by the DSH session of 2026-08-22 (see §19).
**Relationship to shipped work:** Builds ON TOP of the two remote fixes already on `main` this session (`851e656a1` freshness honesty / truthful busy responses / dead P2P removal / relay health; `2d83e43eb` phone mode targeting / full boardroom relay / notes tools). It does not overlap or replace them — see §19.1 for what changed under its feet.

---

## THE DIRECTIVE (verbatim)

@start

INDII REMOTE STUDIO EXECUTOR — ARCHITECTURE & IMPLEMENTATION DIRECTIVE

OBJECTIVE

Improve Indii's remote-control architecture so the user's Studio machine remains reliably reachable and useful remotely without depending on React/browser lifecycle behavior.

Do this WITHOUT redesigning systems that already work.

This directive is based on review of the current repository, including:

- useRemoteCommandListener.ts
- RemoteRelayService
- App.tsx
- Electron main process
- StudioExecutorLeaseService
- AgentService / EntryCommandService
- Computer Execution architecture
- local audio handlers
- mobile remote implementation
- remote relay tests
- computer_task tests
- dispatch tests
- existing remote-control documentation/flowcharts

CORE PRINCIPLE

DO NOT rewrite Indii's remote system.

DO NOT remove Electron.

DO NOT create another execution layer.

DO NOT move the entire existing execution system into a background process.

The architectural problem is narrower:

REMOTE TRANSPORT / STUDIO EXECUTOR LIFECYCLE is currently coupled to the React renderer.

Separate remote executor lifecycle from actual Indii execution first.

Only after that separation has been proven should the smallest necessary component be moved into a renderer-independent background runtime.

==================================================
1. EXISTING ARCHITECTURE — PRESERVE IT
==================================================

Indii already has the core remote architecture:

Phone / Remote Client
        ↓
Firestore Remote Relay
        ↓
Studio Executor
        ↓
Existing Indii Execution Layer
        ↓
Local / Cloud capabilities

RemoteRelayService already provides substantial infrastructure including:

- Phone-to-Studio command transport.
- Studio-to-phone responses.
- Durable Firestore command/response records.
- cloud vs studio execution targeting.
- Studio instance identity.
- listenerReady state.
- Executor device identity.
- Desktop presence/heartbeat.
- Sleep state.
- Remote computer_task dispatch.
- Agent dispatch queue.
- Cross-network operation.
- Authentication/ownership controls.
- Atomic task/command claiming.
- Studio executor lease architecture.
- Durable pending-work recovery.

THIS INFRASTRUCTURE IS NOT TO BE REPLACED.

Extend it.

==================================================
2. ACTUAL CURRENT PROBLEM
==================================================

The Studio remote executor currently lives substantially inside:

packages/renderer/src/hooks/useRemoteCommandListener.ts

It is mounted through the React application.

The current lifecycle is effectively:

Electron Process
        ↓
BrowserWindow
        ↓
React Renderer
        ↓
useRemoteCommandListener
        ↓
Remote Studio Executor

The Electron window itself can already be hidden to the system tray.

Electron main deliberately prevents ordinary window closing from terminating Studio.

backgroundThrottling: false is already used to help remote operation continue.

However:

THE REACT RENDERER STILL HAS TO REMAIN ALIVE FOR THE CURRENT STUDIO EXECUTOR TO REMAIN ALIVE.

The implementation contains browser-lifecycle workarounds including heartbeat handling affected by background throttling and visibility changes.

Remote Studio availability should not fundamentally depend upon React rendering.

==================================================
3. IMPORTANT CORRECTION — DO NOT SIMPLY MOVE THE HOOK
==================================================

Do NOT take useRemoteCommandListener.ts and move the whole thing into Electron main, utilityProcess, Node, or another background runtime.

Repository inspection shows that this hook currently mixes TWO fundamentally different responsibilities.

CATEGORY A:

REMOTE EXECUTOR / TRANSPORT RESPONSIBILITIES

These should become renderer-independent.

Examples:

- Studio identity.
- Studio presence.
- Heartbeat.
- listenerReady.
- Firestore command subscription.
- Pending-command recovery.
- Atomic command claiming.
- Executor lease handling.
- Dispatch queue subscription.
- Dispatch task claiming.
- Processing locks.
- Processing timeouts.
- Response publishing.
- Completion/failure status publishing.
- Durable backlog recovery.
- Relay cleanup.
- Studio execution ownership.

CATEGORY B:

INDII EXECUTION / UI RESPONSIBILITIES

These should NOT automatically be moved out of the renderer.

Current examples include dependencies on:

- Zustand / useStore.
- AgentService.
- EntryCommandService.
- navigation state.
- right-panel state.
- generated-history lookup.
- Notes/capture behavior.
- ImageGenerationService.
- DAW playback state.
- media playback state.
- window.electronAPI.
- window dimensions.
- wake/show UI behavior.
- computer execution capabilities.
- existing agent history.
- renderer-side execution state.

Therefore:

PHASE ONE IS A SEPARATION-OF-CONCERNS PROJECT.

IT IS NOT YET A PROCESS-MIGRATION PROJECT.

==================================================
4. TARGET INTERMEDIATE ARCHITECTURE
==================================================

Create a renderer-independent abstraction:

STUDIO EXECUTOR CORE

Its responsibility is ONLY remote transport/executor lifecycle.

Conceptually:

Firestore Remote Relay
        ↓
STUDIO EXECUTOR CORE
        ↓
normalized command/task
        ↓
STUDIO EXECUTION ADAPTER
        ↓
Existing Indii Execution Layer
        ↓
┌─────────────────┬─────────────────┐
│                 │                 │
Renderer          Electron          Cloud
Capabilities      Capabilities      Capabilities
│                 │                 │
Agents/UI/Store   Audio/OS/etc.     Cloud tools

The Studio Executor Core must NOT contain business logic for every Indii capability.

Instead it delegates execution.

==================================================
5. STUDIO EXECUTOR CORE
==================================================

Extract a StudioExecutorCore abstraction.

Initially this may STILL RUN INSIDE THE RENDERER.

That is intentional.

Do not change process boundaries until behavioral parity has been demonstrated.

StudioExecutorCore should own things such as:

- Studio instance identity.
- startup/shutdown lifecycle.
- Firestore subscriptions.
- Studio presence.
- heartbeat.
- listener readiness.
- executor ownership.
- command filtering.
- cloud vs studio ownership determination.
- atomic command claiming.
- pending command scanning.
- backlog recovery.
- dispatch queue subscription.
- atomic dispatch claiming.
- processing serialization.
- processing timeout recovery.
- command/task status.
- response publishing.
- failure publishing.
- relay cleanup.
- executor lease enforcement where appropriate.

StudioExecutorCore MUST NOT directly depend on:

- React.
- useEffect.
- useRef.
- useCallback.
- document.visibilityState.
- window.innerWidth.
- React component mounting.
- visual UI state.
- Zustand UI actions.
- DAW UI controls.
- generated-history UI lookup.

The Core should have explicit:

start()
stop()
execute/delegate()
health/presence lifecycle

semantics.

==================================================
6. STUDIO EXECUTION ADAPTER
==================================================

Create an explicit execution boundary between the Executor Core and existing Indii execution.

For example conceptually:

StudioExecutionAdapter

The exact name is implementation-dependent.

The adapter is responsible for translating normalized remote requests into EXISTING Indii behavior.

It may delegate to:

- AgentService.
- EntryCommandService.
- existing tool execution.
- Notes/capture services.
- ImageGenerationService.
- DAW/media operations.
- generated-history lookup.
- navigation/UI behavior.
- computer execution.
- Electron IPC.
- local audio functionality.

DO NOT create a second AgentService.

DO NOT create a remote-specific agent runtime.

DO NOT duplicate tools.

DO NOT duplicate permission systems.

REMOTE AND LOCAL EXECUTION MUST CONVERGE ON EXISTING INDII INFRASTRUCTURE.

==================================================
7. CAPABILITY-AWARE STUDIO PRESENCE
==================================================

The current idea of "desktop online" is eventually insufficient.

After separating executor lifecycle from renderer lifecycle, Studio can have multiple meaningful capability states.

Design presence so it can evolve toward capability awareness.

Examples:

Studio offline.

Studio executor online.

Studio executor online / UI unavailable.

Studio executor online / UI available.

Studio executor online / agent execution available.

Studio executor online / computer execution available.

Studio executor online / local audio available.

Studio executor online / DAW available.

Do NOT necessarily implement an elaborate capability framework immediately.

But do NOT design the extraction in a way that assumes:

heartbeat == every Studio capability is available.

The phone should eventually be able to distinguish:

"The Studio machine is offline"

from:

"The Studio executor is online, but this operation requires a currently unavailable capability."

==================================================
8. CLOUD VS STUDIO EXECUTION
==================================================

Preserve the existing distinction:

executionTarget: 'cloud' | 'studio'

This is architecturally valuable.

Cloud-capable work should NOT unnecessarily depend on the user's Studio computer.

Studio-only work should route to the trusted Studio executor.

Examples of likely Studio-local capabilities:

- computer control.
- local files.
- DAW control.
- local audio processing.
- native integrations.
- OS-level operations.

Do not collapse cloud and Studio execution into one runtime.

==================================================
9. ELECTRON MUST REMAIN
==================================================

This is NOT an Electron-removal project.

Electron currently has legitimate responsibilities.

The repository already places important local audio functionality in Electron main.

Examples include:

- FFmpeg processing.
- FFprobe.
- SHA-256 hashing.
- loudness analysis.
- transcoding.
- mastering.
- filesystem access.
- filesystem security.
- file-path validation.
- user access-control verification.
- computer/native capabilities.

Keep those responsibilities local.

Electron remains part of Indii Studio.

The architectural goal is:

ELECTRON UI / REACT RENDERER SHOULD NOT BE THE THING KEEPING REMOTE INDII ALIVE.

That is different from removing Electron.

==================================================
10. AUDIO PRIVACY BOUNDARY
==================================================

Preserve local audio processing where designed.

Remote commands should be capable of requesting local audio operations without requiring original/master audio to traverse the remote-control channel.

Important existing behavior:

audio:analyze currently creates a reduced proxy:

- mono.
- 32 kHz.
- 64 kbps MP3.

That proxy is Base64 encoded for cloud analysis.

Therefore accurately preserve the current privacy distinction:

ORIGINAL / HIGH-QUALITY SOURCE AUDIO REMAINS LOCAL.

A REDUCED PROXY MAY INTENTIONALLY BE SENT FOR CLOUD ANALYSIS.

Do NOT accidentally expand what audio leaves the machine during this architecture work.

Do NOT move source/master processing to the cloud simply because remote execution is being improved.

==================================================
11. SECURITY / GOVERNANCE — NON-NEGOTIABLE
==================================================

Extraction must preserve existing security boundaries.

Do not bypass or weaken:

- ToolRiskRegistry.
- DigitalHandshake.
- Studio executor leases.
- tool authorization.
- schema validation.
- IPC sender validation.
- access controls.
- Computer Execution approval requirements.
- audit logging.
- kill switches.
- desktop-only capability restrictions.
- ownership validation.
- authentication.

A background Studio executor MUST NOT become a privileged shortcut around Indii governance.

Remote computer_task behavior must continue to flow through the existing Computer Execution safety architecture.

Phone-originated work must NOT become implicitly trusted simply because it came through an authenticated relay.

==================================================
12. SINGLE EXECUTOR INVARIANT
==================================================

THIS IS A HARD MIGRATION RULE.

At no point should the old renderer listener and a new background Studio executor independently operate as competing production consumers.

Existing atomic claiming provides protection.

DO NOT rely on that as an excuse to deliberately operate two executor architectures indefinitely.

Migration must explicitly control executor ownership.

Exactly one active Studio executor should own Studio work for a Studio instance according to existing lease/claim semantics.

==================================================
13. TEST-FIRST MIGRATION
==================================================

The repository already contains tests around:

- useRemoteCommandListener.
- dispatch behavior.
- computer_task.
- RemoteRelayService.
- MobileRemote.

Use these as the starting characterization suite.

Before changing runtime boundaries, add/strengthen characterization coverage for:

- command receipt.
- cloud vs studio filtering.
- atomic claiming.
- duplicate listener protection.
- Studio lease behavior.
- heartbeat/presence.
- listenerReady.
- pending-command recovery.
- backlog recovery.
- dispatch claiming.
- task completion.
- task failure.
- processing timeout recovery.
- response publishing.
- computer_task security.
- approval behavior.
- Studio wake behavior.
- cleanup.
- executor restart.
- durable pending work.

Do not change behavior and architecture simultaneously without tests proving what changed.

==================================================
14. IMPLEMENTATION SEQUENCE
==================================================

Follow this order unless repository evidence demonstrates a safer smaller sequence.

PHASE 1 — CHARACTERIZE

Lock current behavior with tests.

Document current dependencies of useRemoteCommandListener.

Classify every responsibility into:

A. Studio Executor Core.
B. Existing Execution Layer dependency.
C. Renderer/UI-only capability.
D. Electron/native capability.
E. Cloud-owned capability.

PHASE 2 — EXTRACT CORE

Create StudioExecutorCore.

Keep it in the renderer initially.

Move only transport/executor lifecycle responsibilities into it.

Existing behavior must remain equivalent.

PHASE 3 — CREATE EXECUTION ADAPTER

Put renderer/execution dependencies behind an explicit interface.

StudioExecutorCore should delegate normalized commands/tasks instead of directly manipulating UI/business systems.

PHASE 4 — REMOVE BROWSER ASSUMPTIONS FROM CORE

StudioExecutorCore must become independent of:

- React lifecycle.
- document visibility.
- browser timer assumptions.
- viewport dimensions.
- React refs/effects.
- UI mounting.

Run it inside the existing environment first and prove parity.

PHASE 5 — CAPABILITY/PRESENCE MODEL

Separate:

executor online

from:

specific execution capability available.

Keep this implementation as small as practical.

PHASE 6 — SELECT BACKGROUND RUNTIME

ONLY NOW determine the correct runtime.

Evaluate actual dependency evidence.

Possible options include:

- Electron main/background infrastructure.
- Electron utilityProcess.
- Node sidecar.
- OS-level service.

DO NOT select based on fashion or another product's architecture.

Select the SMALLEST runtime that solves the renderer-lifecycle dependency safely.

PHASE 7 — MOVE ONLY THE NECESSARY CORE

Move StudioExecutorCore into the selected background runtime.

Do NOT automatically move the existing execution layer with it.

Create explicit IPC/message boundaries where renderer or Electron functionality is required.

PHASE 8 — UI WAKE / CAPABILITY HANDOFF

For commands genuinely requiring the renderer:

background executor
        ↓
detect capability requirement
        ↓
wake/start renderer if appropriate
        ↓
delegate execution
        ↓
receive result
        ↓
publish remote response

Do NOT wake the UI for work that can execute without it.

PHASE 9 — CUTOVER

Disable/remove the old hook-owned production listener.

Ensure there is one authoritative Studio executor.

Validate lease/claim behavior.

Validate restart recovery.

Validate tray/background operation.

Validate remote operation with the normal Studio UI absent when supported.

==================================================
15. WHAT WE DO NOT DO
==================================================

DO NOT:

- Replace Electron.
- Rewrite RemoteRelayService.
- Replace Firestore relay architecture.
- Create another remote-control subsystem.
- Create another execution layer.
- Create another agent runtime.
- Duplicate AgentService.
- Duplicate tools.
- Duplicate Computer Execution.
- Move source audio processing to the cloud.
- Separate the audio engine from Electron without demonstrated need.
- Replace Studio executor leases.
- Replace DigitalHandshake.
- Replace ToolRiskRegistry.
- Bypass Brain–Body–Bridge architecture.
- Turn mobile into generic remote desktop.
- Assume every remote action requires a visible desktop UI.
- Assume heartbeat means every capability is available.
- Choose Tauri merely because Electron is involved.
- Choose utilityProcess before dependency analysis.
- Choose Node daemon before dependency analysis.
- Choose an OS service before dependency analysis.
- redesign working execution infrastructure for architectural purity.

EXTEND WHAT EXISTS.

==================================================
16. DESIRED FINAL USER EXPERIENCE
==================================================

The intended user experience is:

1. User installs/signs into Indii Studio.

2. User authorizes the computer and appropriate local capabilities.

3. Indii establishes the trusted Studio executor.

4. User can close/hide the normal Studio UI when it is unnecessary.

5. Studio executor remains available independently of React UI lifecycle where technically supported.

6. User leaves the computer powered on.

7. User leaves home/studio.

8. User opens Indii from phone or another authorized remote client.

9. Indii knows whether the Studio executor is reachable.

10. Indii knows which Studio capabilities are currently available.

11. Cloud-capable requests execute in the cloud.

12. Studio-targeted requests route to the Studio executor.

13. Background-capable Studio work executes without unnecessarily waking the UI.

14. Renderer-dependent work explicitly wakes/uses the renderer when required.

15. Local audio remains processed locally according to existing privacy boundaries.

16. Computer/DAW/files/native operations continue through existing Indii security and execution systems.

17. Status/results return through the existing remote relay.

18. Durable work survives temporary disconnects/restarts where existing relay semantics allow it.

==================================================
17. FINAL TARGET ARCHITECTURE
==================================================

                         INDII CLOUD
                              │
                       Firestore Relay
                              │
               ┌──────────────┴──────────────┐
               │                             │
        Mobile / Remote               Cloud Execution
               │
               │ studio-targeted work
               ▼
        STUDIO EXECUTOR CORE
        renderer-independent
               │
               ▼
       STUDIO EXECUTION ADAPTER
               │
               ▼
       EXISTING EXECUTION LAYER
               │
       ┌───────┼────────┬─────────┐
       │       │        │         │
     Agent   Audio   Computer    DAW/Files
       │       │        │         │
       └───────┴────────┴─────────┘
               │
          LOCAL MACHINE

               ↕
       INDII ELECTRON / REACT UI
          ONLY WHEN REQUIRED

==================================================
18. ACCEPTANCE CRITERIA
==================================================

The work is complete only when:

- Studio presence no longer fundamentally depends on React/browser lifecycle behavior.

- Heartbeat no longer depends on browser visibility/timer behavior after background cutover.

- Existing Firestore relay contracts remain compatible unless a deliberately versioned migration is required.

- cloud vs studio execution ownership remains intact.

- Exactly one valid Studio executor claims Studio work.

- Executor lease semantics remain enforced.

- Existing security/governance remains enforced.

- computer_task does not gain an approval bypass.

- Existing local Electron audio functionality remains operational.

- Existing DAW/computer/native functionality does not regress.

- Original/master audio is not newly uploaded because of this work.

- Durable pending work can recover after Studio executor restart.

- Renderer-independent work can execute without requiring React to remain alive.

- UI-dependent work has an explicit execution boundary.

- UI-dependent work can honestly report capability unavailability rather than making the entire Studio appear offline.

- Existing remote behavior has characterization/regression tests.

- Old renderer-owned production consumption is removed/disabled after cutover.

==================================================
FINAL ENGINEERING DIRECTIVE
==================================================

Do not begin by choosing a new runtime.

Do not begin by moving the entire hook.

Do not begin by redesigning Indii.

FIRST:

Audit and classify the responsibilities currently contained in useRemoteCommandListener.

SECOND:

Extract the remote transport/executor lifecycle into a testable StudioExecutorCore while leaving it in the current process.

THIRD:

Put actual Indii execution behind a StudioExecutionAdapter that reuses the existing Execution Layer.

FOURTH:

Prove behavioral parity.

FIFTH:

Determine from the resulting dependency graph the smallest safe renderer-independent runtime for StudioExecutorCore.

SIXTH:

Move only what needs to move.

The governing architectural principle is:

REMOTE EXECUTOR LIFECYCLE MUST BE INDEPENDENT FROM REACT RENDERING, WHILE ACTUAL INDII EXECUTION CONTINUES TO REUSE THE EXISTING EXECUTION, SECURITY, ELECTRON, AUDIO, COMPUTER, DAW, AND CLOUD INFRASTRUCTURE.

Extend the existing architecture.

Do not duplicate it.

Do not rewrite working systems for architectural purity.

Make the smallest safe structural change that gives Indii a persistent, reliable Remote Studio Executor.

---

## 19. REPOSITORY EVIDENCE ANNOTATIONS (DSH session, 2026-08-22)

These annotations verify, correct, and extend the directive against the tree as of `2d83e43eb`. Where the directive's premises have moved, the CURRENT state is authoritative.

### 19.1 What already changed under this plan (same-day shipped work)

The directive was drafted against a pre-audit snapshot. Since then, on `main`:

- **Presence freshness is honest.** `onDesktopState` no longer stamps `_localReceivedAtMs` on every snapshot; freshness derives from witnessed heartbeat-ADVANCE (`_heartbeatAdvancedAtMs`, local monotonic clock) or the doc's own server-timestamp age. Any extraction must preserve this contract — `isFreshDesktopState` / `studioStateFreshnessRemainingMs` in `RemoteRelayService.ts` and the Controller's stale-timer mirroring in `MobileRemote.tsx`.
- **The processing lock is now synchronous** and released in a single `finally`; `AgentService` queues are a bounded FIFO with an `isAgentBusy` getter; the relay reports QUEUED honestly (`shouldReportQueuedChatToRemote`) and dispatch tasks fail loudly via `assertDesktopWasFreeToRun`. Category A's "processing serialization / timeouts" items have newer, tested shapes than the directive describes.
- **All desktop writes flow through executor-lease Cloud Functions** (`publishStudioPresence`, `claimStudioCommand`, `publishStudioResponse`, `completeStudioCommand`, `releaseStudioPresence`, `issueStudioExecutorLease`). A background runtime inheriting the Core must hold the SAME Electron keychain enrollment (`StudioExecutorLeaseService.getLease` requires `window.electronAPI.credentials`) — this is a hard dependency-graph input for the Phase 6 runtime decision, not a detail.
- **Phone-side contracts to keep stable:** command metadata schema is rules-validated (`isValidRemoteRelayMetadata` now includes enum-checked `conversationMode`); `executionTarget` gating (`shouldProcessStudioCommand`); response docs with per-agent `agentId`/`boardroomMessageId` (full boardroom relay, cap 12); `DesktopState` fields incl. `sleepMode`, `listenerReady`, `studioInstanceId`.
- **Notes/files/boardroom reachability** (the founder's bottom line) now works through the existing hook path; the extraction must not regress it — `NotesTools` are declared in `SUPERPOWER_TOOLS`, implemented in `BaseAgent.functions`, risk-registered.

### 19.2 Verified factual claims

- **Renderer coupling (§2):** TRUE. `useRemoteCommandListener(isStudioExecutor)` mounts in `App.tsx` (line ~150); heartbeat loop, subscriptions, and claiming all live in the hook. Mitigations exist (`backgroundThrottling: false` in `packages/main/src/main.ts` ~line 167, visibilitychange immediate push, 120s stale window) but are mitigations, not decoupling.
- **Audio privacy boundary (§10):** VERIFIED. `packages/main/src/handlers/audio.ts` ~lines 115–124: reduced proxy (32 kHz, 64k bitrate, mono) is base64-encoded for cloud analysis while originals stay local. Preserve exactly.
- **No background runtime exists yet (§14 Phase 6):** VERIFIED. No `utilityProcess`/`MessagePortMain` anywhere in `packages/main`; only `child_process` spawns (python bridge, FoundationalSkillService, computer providers). Any runtime choice is greenfield.
- **Single-executor protection (§12):** EXISTS via lease-gated atomic claim transaction (`claimStudioCommand` flips `pending → processing` only for the lease holder; `releaseStudioPresence` is instance-scoped). The directive's rule stands: do not run two production consumers anyway.
- **Characterization suite (§13):** PARTIALLY EXISTS and is stronger than the directive assumes. Green suites already cover: command receipt/filtering, atomic claiming, busy-queue honesty, dispatch guards, computer_task guards, presence freshness (incl. cache-forgery regression), routing (`routing.test.ts`, `App.remoteSurface.test.ts`), notes tools. Phase 1 should DIFF-audit this list against §13's checklist rather than start from zero. Known thin spots: executor restart recovery, durable backlog after process death, lease-expiry mid-run, cleanup ordering.

### 19.3 Additions the directive should absorb

1. **Capability presence has a natural home (§7).** Presence already flows through `publishStudioPresence` (server-projected into `users/{uid}/remote-relay/state`) and the renderer-side `studioRelayHealth` tracker added this session. Extend the state schema (e.g., `capabilities: { agent, computer, audio, daw, ui }`) server-side + `DesktopState` type + rules if needed — do NOT invent a second presence channel.
2. **Rules are a write gate.** Any new command metadata or state fields must extend `isValidRemoteRelayCommand` / `isValidRemoteRelayMetadata` + emulator tests, or phone writes fail closed. This bit us once already (conversationMode).
3. **Wake behavior is Category B/C.** `wakeDesktop()` (store `setIsSleeping` + `window.electronAPI.window.show`) is UI behavior living inside the current hook; under the Core/Adapter split it belongs behind the adapter, and §8's "do not wake for background-capable work" becomes an adapter decision.
4. **`useAutoSleep` interplay.** Sleep state is set by a separate renderer hook and published via heartbeat. A background executor changes who owns `sleepMode` — decide explicitly in Phase 5/8 (likely: Electron main owns sleep, Core reports it).
5. **Controller-side freshness budget.** `DESKTOP_HEARTBEAT_STALE_MS = 120s` + 30s skew is tuned for a throttled renderer heartbeat. A background executor can heartbeat reliably every 5s; tightening the stale window after cutover is a UX win — but only after cutover, never during parity.
6. **Preload IPC orphans** (`remote.onMessageFromMobile`, `remote.broadcast`) remain removed from renderer use; if the Core moves to main, this surface is the natural place to define the new Core↔renderer boundary instead (supersedes the earlier "delete them" follow-up).

### 19.4 Suggested first work package (when implementation starts)

Phase 1 only: produce the §14 responsibility classification as a checked-in doc (file-by-file dependency table for `useRemoteCommandListener.ts` + `StudioExecutorLeaseService` + `useAutoSleep`), diff §13's checklist against existing suites, and add the missing characterization tests. No production code changes. Exit criterion: the classification table is complete and every §13 item is either covered by a named test or listed as a gap with an owner test file.

---

## 20. PHASE 1 RESULT — RESPONSIBILITY CLASSIFICATION & CHARACTERIZATION DIFF (2026-08-22)

Phase 1 executed per §19.4: classification complete, §13 checklist diffed against the live inventory, characterization tests added where exported surfaces allowed. **Zero production-code changes** (test files + this doc only). New coverage: `StudioExecutorLeaseService.test.ts` 1→8 tests, `RemoteRelayService.test.ts` +3 dispatch-receipt tests.

### 20.1 Responsibility classification (Category A executor-core / B execution-layer / C renderer-UI / D Electron-native / E cloud-owned)

| # | Responsibility | Cat | Current home | Notes for extraction |
|---|---|---|---|---|
| 1 | Auth gating (onAuthStateChanged, guest/demo exclusion) | A | hook | security-relevant; moves with Core |
| 2 | Executor-surface gating (Controller never executes) | A | `routing.ts` via `App.tsx` | keep at mount boundary |
| 3 | Heartbeat loop (5s) + visibilitychange immediate push | A | hook effect | **browser-coupled — the Phase 4 target** |
| 4 | Immediate presence push on state change | A | hook effect | reads refs, no React APIs otherwise |
| 5 | Presence payload (role/listenerReady/studioInstanceId/sleepMode) | A | hook | schema lives server-side in `publishStudioPresence` |
| 6 | Presence publication via executor lease | A→D→E | `RemoteRelayService`→`StudioExecutorLeaseService`→callables | keychain enrollment is D; server projection is E |
| 7 | `releaseStudioPresence` on unmount | A lifecycle | hook cleanup | instance-scoped guard server-side |
| 8 | Command subscription + text/target filtering | A | hook | rules-validated writes |
| 9 | Atomic command claim | A→E | hook→`claimStudioCommand` | lease-gated transaction |
| 10 | `isLocalP2PCommand` legacy guard | A legacy | hook | defense only; no p2p producer since P2P removal |
| 11 | `wakeDesktop` (setIsSleeping + `window.show`) | **C** | hook callback | §19.3.3: adapter decision, not Core |
| 12 | Processing lock (synchronous) + timeout recheck loop | A | hook closure | closure-internal timers — extraction must own them |
| 13 | `parseRemoteCommand` rejection → response | A | hook | validation itself in `remoteCommandSecurity.ts` |
| 14 | [WAKE]/[NAVIGATE]/[GENERATE_IMAGE]/[GENERATE_VIDEO]/[SHOW]/[AGENT_ACTION]/[DAW_CONTROL]/[MEDIA_PLAYBACK] routes | B/C | inline `processSingleCommand` | store/UI/Image/VideoGeneration deps |
| 15 | Chat route (EntryCommandService → AgentService → collect responses → queued honesty) | B | hook | mode override validated A-side |
| 16 | Dispatch-task subscription + atomic claim | A | hook | |
| 17 | Dispatch handlers (live_moment, direct notes, venue pin, agent fallback, computer_task guards) | B/C | hook | `addNote`/`addUserPin`/window.electronAPI.computer |
| 18 | `updateDispatchTaskStatus` receipts | A | hook | |
| 19 | `scanAndProcessPendingCommands` backlog sweep | A | hook | |
| 20 | `writeDiagnostic` Firestore telemetry | A | hook | |
| 21 | `cleanupOld` 30-min pruning | A | hook | |
| 22 | Keychain enrollment (get/save) | D | `window.electronAPI.credentials` | **hard Phase-6 input: Core needs this in any runtime** |
| 23 | Lease issue/cache/reissue | A | `StudioExecutorLeaseService` | 60s cache floor, tested |
| 24 | `useHttpRelayFallback` | legacy | hook (disabled) | deletion candidate at cutover |
| 25 | Auto-sleep idle detection → `setIsSleeping` | C | `useAutoSleep` | sleepMode *publication* is A (row 5); ownership decision per §19.3.4 |

Summary: **A ≈ 17 items** form a coherent Core; **B/C ≈ 7** belong behind the Adapter; **D** is the keychain bridge; **E** is the server trust boundary. No responsibility resists classification — the §3 two-category thesis holds.

### 20.2 §13 checklist diff (named test or GAP)

| §13 item | Status | Evidence |
|---|---|---|
| command receipt | GAP-G1 | subscription wiring untested; testable via Core `start()/stop()` post-extraction |
| cloud vs studio filtering | ✅ | `shouldProcessStudioCommand` + `resolveRemoteCommandExecutionTarget` truth tables |
| atomic claiming (commands) | ✅ verdict mapping / GAP-G2 transaction | lease suite asserts callable delegation; server transaction untested (see G2) |
| duplicate-listener protection | GAP-G1 | `isProcessing` closure-internal |
| Studio lease behavior | ✅ | lease suite: cache floor, expiry re-issue, browser refusal, payload shapes |
| heartbeat/presence freshness | ✅ predicates / GAP-G1 loop | advance-forgery + skew tests; loop emission structural |
| listenerReady | ✅ | `isFreshStudioState` tests |
| pending-command recovery | GAP-G1 | `scanAndProcessPendingCommands` not exported |
| backlog recovery after restart | GAP-G1 | structural |
| dispatch claiming | ✅ | ISSUE-984 transaction test (`claimDispatchTask`) |
| task completion/failure receipts | ✅ | new `updateDispatchTaskStatus` tests (pickedUpAt/completedAt/error/result, no-auth no-op) |
| processing timeout recovery | GAP-G1 | closure timers |
| response publishing | ✅ | `serializeRemoteResponse` + `publishResponse` payload test |
| computer_task security | ✅ guards / GAP-G1 flow | `validateComputerTaskDispatch` + guard order; lease-check flow needs harness |
| approval behavior (DigitalHandshake) | N/A here | enforced in executor/tools layer; must not regress (§11) |
| Studio wake behavior | GAP-G1 | renderer-dependent (row 11) |
| cleanup | PARTIAL | unmount release GAP-G1; rules-level protections tested in rules suite |
| executor restart durability | GAP-G1 | structural |
| durable pending work | ✅ | `cancelCommand` ISSUE-989 tests |

**Gap classes:**
- **G1 — harness gaps:** untestable until the Core exposes `start()/stop()` lifecycle (Phase 2 makes them testable by design). Nine items.
- **G2 — cloud-side:** the six lease callables in `packages/firebase/src/functions/remote/` have NO unit tests. The renderer suite pins client payloads; server-side lease validation/expiry/ownership logic is unpinned. Recommend a `packages/firebase` callable test suite as its own follow-up unit (out of Phase-1 renderer scope, flagged per §11).

### 20.3 Phase-1 exit check (§19.4)

Classification table: complete. §13 diff: every item covered-by-named-test or classified GAP with owning class. Production code: unchanged (test files + docs only). **Phase 1 exit criterion met. Phase 2 (extract StudioExecutorCore in-renderer) is the next unit and should consume G1 as its test-first target list.**
