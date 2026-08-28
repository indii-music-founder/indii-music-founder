# Agent → Video Editor Bridge (CD Agent Edit Capability)

**Status:** Spec of record — ticketed as ISSUE-1416 in `.agent/test_ledger/OPEN_ISSUES_V3.md`.
**Origin:** Founder request (2026-08-28) after the in-app Creative Director stated it could not
mix clips and proposed headless browser automation as a workaround.
**Author:** DSH coding agent.

---

## 1. Problem statement

The conductor agents (Creative Director, Producer, Director) cannot assemble finished films
from the user's existing rendered assets. When asked to "mix these clips together," the CD
correctly refuses — and both parties then speculate about headless *external* browser
automation, which is the wrong architecture: the platform already owns a first-class,
server-authoritative stitch pipeline. The actual gap is one missing layer of **agent tools**.

## 2. What already exists (do NOT rebuild)

| Capability | Where | Contract |
|---|---|---|
| Timeline composition model | `packages/renderer/src/services/video/PerformanceVideoService.ts` | `VideoProject` (`tracks`, `clips`, `durationInFrames`, `fps`, dimensions) |
| Stitch/render submission | `renderVideo` callable → Inngest stitch job | Requires `{ compositionId, inputProps: { project } }` (ISSUE-994); returns `{ success, renderId, message }` — **never a URL** |
| Job completion | `videoJobs/{renderId}` doc, polled via `VideoGenerationService.waitForJob` | Terminal status + `output.url` |
| Long-form/multi-segment | `videoJobs` `type: 'long_form'`, `segmentUrls` + server-owned stitch manifest | `ParallelRenderOrchestrator` is deliberately fail-closed until server-owned chunk/stitch receipts exist — do not agent-drive it |
| Agent video tools precedent | `tools/VideoTools.ts` (`generate_video`, `generate_video_chain`) | Proves agent tools can submit billable video jobs and poll honestly |
| Cost authority | `enforceOperationCost` / `reserveCost` (server) | Throws `resource-exhausted` when under-reserved (ISSUE-1412) — every billable call must route through it |
| Typed storyboards | `ScreenwriterStoryboardHandoff` (ISSUE-1143) | Scene→slot mapping with duration/camera/order provenance |
| Risk gating | `ToolRiskRegistry`, `ExecApprovalService` | Explicit entries only (ISSUE-1404: never advertise phantom tools); high-risk categories fail closed |

## 3. The gap

There is no agent-executable path from "these finished clips exist" to "a stitched film
exists." Concretely, four operations are missing from the tool registry:

1. **Discover** — list the user's rendered, downloadable assets with the metadata timeline
   math needs (duration, dimensions, fps, provenance).
2. **Plan** — propose an ordered sequence (no render, no cost): order, in/out points,
   transition notes, target output spec.
3. **Execute** — build the `VideoProject` and submit the real stitch through `renderVideo`.
4. **Report** — honest job status and the final URL, indistinguishable from what the UI shows.

## 4. Proposed tools (new file: `tools/EditorTools.ts`)

### 4.1 `video_list_renderable_assets` — READ-ONLY
- Input: optional filter (project, date range, minimum duration).
- Source of truth: `generatedHistory` (master library) joined with terminal `videoJobs`
  docs; only assets with a real Storage URL qualify.
- **Duration rule:** if duration is unknown, report `duration: null` — the execute tool must
  refuse sequences containing unknown-duration clips (fail closed, §4.3). If Electron is
  present, `ffprobe` via existing main-process IPC may fill durations; web-only runs never
  fake them.

### 4.2 `video_plan_sequence` — READ-ONLY
- Input: ordered asset IDs, optional per-clip in/out, transition intent, output spec.
- Output: a typed sequence plan (mirrors `ScreenwriterStoryboardHandoff` slot discipline:
  order, exact start seconds, duration, source provenance) **plus a validation report**:
  missing assets, unknown durations, resolution/fps mismatches, total runtime.
- No submission, no cost. The CD can iterate here freely.

### 4.3 `video_render_stitch` — HIGH-RISK, BILLABLE
- Input: an approved sequence plan (must be the output of 4.2 or pass the same validator).
- Hard gates, all fail-closed:
  1. Every source URI resolves to a user-owned asset (no external/hotlinked URLs).
  2. All durations known; timeline math sums correctly.
  3. Server cost reservation succeeds (`enforceOperationCost`) **before** the callable fires —
     the ISSUE-1402 founder-visible denial must surface as an honest agent message, never a
     silent fallback.
  4. Explicit user approval via `ExecApprovalService` (billable render category), consistent
     with the desktop-execution trust model; remote (phone-initiated) requests additionally
     honor the relay's mode/confirmation discipline.
- Behavior: builds `VideoProject`, calls `renderVideo` with the exact ISSUE-994 contract,
  returns `{ renderId }` and polls `waitForJob` with honest progress states; on failure,
  reports the job's terminal error verbatim. **Never** claims a URL before the job doc has one.
- ToolRiskRegistry: register explicitly with a HIGH risk note (billable, long-running).

### 4.4 `video_get_render_status` — READ-ONLY
- Input: `renderId`. Output: current `videoJobs` state (`queued | rendering | stitching |
  succeeded(+url) | failed(+error)`), cost-settled flag, and elapsed time. Duplicate-safe;
  re-asking is always allowed.

## 5. Non-goals

- **No headless external editors.** BrowserTools exist for web surfaces, but the built-in
  pipeline is faster, free of DOM fragility, and already cost-governed. The CD's headless
  browser idea is explicitly rejected as the mechanism here.
- **No parallel/private chunk rendering** (`ParallelRenderOrchestrator` stays fail-closed
  until server-owned chunk/stitch receipts exist — its own guard says so).
- **No agent-owned exports bypassing the render pipeline** (no direct ffmpeg in renderer;
  desktop local-export stays a user-initiated path).

## 6. Rollout

1. **Slice 1 (this ticket):** `EditorTools.ts` with tools 4.1–4.4, risk registrations, tests
   proving: unknown-duration refusal, under-reservation failure surfaces honestly, no-URL-
   before-terminal honesty, and that `renderVideo` is called with the ISSUE-994 shape.
2. **Slice 2:** wire into the CD/Producer/Director tool pools (`ToolPoolAssembler`,
   `SUPERPOWER_TOOLS`) + help text; the CD's self-description ("I cannot mix clips") gets
   replaced with capability-accurate copy.
3. **Slice 3 (optional):** expose the sequence plan as a `ScreenwriterStoryboardHandoff`
   sibling so plans created in the UI can be executed by the agent and vice versa.

## 7. Acceptance (ISSUE-1416)

- An agent conversation can list real assets, produce a validated plan, and — after explicit
  approval and successful reservation — receive a real stitched URL from `videoJobs`.
- Every failure mode (unknown duration, forged asset, reservation denial, job failure)
  produces an honest, specific agent message; no fabricated success states (house rule:
  ISSUE-950/952 lineage).
- All new tools are declared in `ToolRiskRegistry`; no phantom entries; gates key on
  explicit entries only.
