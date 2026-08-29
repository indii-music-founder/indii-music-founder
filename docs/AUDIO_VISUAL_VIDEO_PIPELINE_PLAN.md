# Audio-Visual Video Pipeline — Capability Audit & Implementation Plan

> **Living plan.** Written 2026-08-28 (DSH planning session; three research-agent sweeps folded in).
> Purpose: close every item in the founder's "Core Endpoints & System Architecture" checklist
> against what indii can actually do today. Written to be executed by a less-experienced agent:
> every task names exact files, exact changes, and acceptance criteria. Update Section 7
> (Current State) before ending any session that touches this work.

---

## 0. Executive verdict

The checklist describes architecture that is **~75% already built**. The app runs
`gemini-omni-flash-preview` through the Gemini Interactions API behind a validated gateway,
runs Veo 3.1 (GA `-001` IDs, Vertex-only) with first/last frames + references + 1080p, has an
Inngest long-form daisy-chain that stitches segments **with the user's canonical master
audio**, a server librosa DSP that measures BPM, a HyperFrames render stack (Remotion is
fully removed), and a storyboard timeline with bar-grid slots plus a Screenwriter handoff.

Real gaps, narrower than the checklist implies:

| # | Checklist item | Verdict | The one-line truth |
|---|----------------|---------|--------------------|
| 1 | Omni model connection | ✅ DONE | `gemini-omni-flash-preview` via `generateOmniRemixV3`; `gemini-omni-1.1-flash` **does not exist** — do not chase it |
| 2 | Stateful Interactions API editing | ✅ DONE | `previousInteractionId` + `previousJobId` with ownership checks; conversational editing in `OmniWorkflow` edit mode |
| 3 | 1,048,576-token context | ⚠️ VERIFY | No 1M config anywhere; real ceilings = 200K-char stream guard + output clamps; TokenEstimator assumes a "2M window" (latent mismatch) |
| 4 | **Audio-Visual Sync (user audio)** | ❌ **FLAGSHIP GAP** | Server DSP measures BPM but stores no beat timestamps; storyboard grid stubbed at 120 BPM; transient-snap path is dead code; assembly-side sync (stitch + `alignSessionMaster`) exists unused for generation timing |
| 5 | 360p draft mode | ❌ MISSING | No draft/final tier (only lite/fast/pro); instant HTML preview exists but no low-res render tier |
| 6 | 720p mobile download | ✅ MOSTLY | Downloads exist; rendering is desktop/cloud-only; mobile path needs real-device verification |
| 7 | 1080p / 4K export | ⚠️ PARTIAL | 1080p wired end-to-end; **UI silently degrades 4K→1080p** ("4K is not yet supported for video"); no upscale anywhere |
| 8 | Start / End frames | ✅ DONE | `firstFrameUri`/`lastFrameUri` → Veo config (gateway V3 only — legacy path ignores them) |
| 9 | Text-to-video + shot controls | ✅ DONE | Director settings: cameraPhysics, cameraMovement, motionStrength, seed, negativePrompt |
| 10 | Image-to-video | ✅ DONE | Both engines + Imagen-4 grounded first-frame pre-flight |
| 11 | Reference-to-video | ✅ DONE | Veo ≤3 refs (Fast/Pro only) + manifest roles; Omni ≤8; Character Library, Likeness, Whisk precise |
| 12 | Scene extension → 40s | ⚠️ PARTIAL | Server long-form daisy-chain works (Transcoder sprite-sheet continuity + stitch); **client `SceneExtensionService` is dead code at runtime**; Veo-native extension does not exist (dead `inputVideo` field) |
| 13 | Storyboard-to-video | ⚠️ PARTIAL | Slots + Screenwriter handoff + `generate_storyboard` tool exist; no single "render the film" orchestration; project is Zustand-only |

**Flagship workstream: WS-3 (Audio-Visual Sync).** Every ingredient exists somewhere —
measured BPM (server DSP), bar grids (storyboard + PerformanceVideoService), segment
continuity (long-form), master-audio stitch + DSP alignment (`alignSessionMaster`) — none of
it connected to generation timing. It is a wiring job, not an invention.

---

## 1. Ground truth: what exists, with evidence

### 1.1 Model registry (single source of truth — never hardcode elsewhere)

`packages/firebase/src/config/models.ts`: `VIDEO = { GENERATION/PRO: 'veo-3.1-generate-001', FAST: 'veo-3.1-fast-generate-001', LITE: 'veo-3.1-lite-generate-001', OMNI: 'gemini-omni-flash-preview' }`; also IMAGE (Nano Banana tiers + `NANO_BANANA_CAPABILITIES`), TEXT (`gemini-3-flash-preview`, `gemini-3-pro-preview`). `gateway.ts:73-77` holds its own `VIDEO_MODEL_IDS` map (default **fast**; `*-preview` IDs deprecated April 2026, ISSUE-867). Override `GEMINI_OMNI_FLASH_MODEL` (`gateway.ts:80`); polling `VIDEO_POLL_INTERVAL_MS`/`VIDEO_MAX_POLLS` (`:81-82`). Renderer mirror: `core/config/intelligence-models.ts` (with forbidden-pattern validation `:174-210`). Client-side provider calls are **hard-disabled** (`FirebaseIntelligenceService.ts:1158-1171` — "Use the secured generateVideoV3 Cloud Function gateway").

### 1.2 The four server generation paths (all Vertex AI via ADC; no API-key path)

| Path | Entry | Model IDs | Mechanics | Output |
|---|---|---|---|---|
| **A: `generateVideoV3`** (primary) | `gateway.ts:1484` (onCall 540s; admission = App Check + verified email + entitlement + Arcjet) | `veo-3.1-{generate,fast,lite}-generate-001` | Callable stages inputs + writes job doc → Firestore trigger `videoJobOrchestrator.ts:6-18` → `executeVideoJob` (`gateway.ts:959-1169`) → `ai.models.generateVideos` + LRO poll 5s×90 | `creative/{uid}/…/video/outputs/*.mp4`; raw provider URIs never reach the browser (`ai.files.download` + re-upload) |
| **B: legacy `triggerVideoJob`** | `index.ts:399-517` → `onDocumentCreated` worker `:529-597` → `video_generation_direct.ts` | same 3 IDs | LRO poll 10s×36. **Never forwards** `negativePrompt`/`seed`/`lastFrame`/`referenceImages` although the schema accepts them (`video.ts:53-94` vs `video_generation_direct.ts:174-197`) | `generated/{uid}/{jobId}.mp4`. Sole live caller: MerchandiseService |
| **C: long-form daisy-chain** | `triggerLongFormVideoJob` (`index.ts:604-709`) → Inngest `video/long_form.requested` → `long_form_video.ts:185-617` | via `resolveVeoModel` | Raw REST `predictLongRunning` (`:269`); per-segment last-frame via **Transcoder sprite sheet** at `segmentDuration-0.5s` (`:431-556`); segments 4/6/8s from `totalDuration/prompts.length` (`:279-285`), default 5s | `generated/{uid}/long-form/{jobId}/…`; then `video/stitch.requested` → Transcoder stitch, **canonical-master two-pass with master audio mix** (`:791-937`) |
| **D: Omni `generateOmniRemixV3`** | `gateway.ts:1945-2135` | `gemini-omni-flash-preview` (location `VERTEX_OMNI_LOCATION \|\| 'global'`) | `ai.interactions.create` (`:2033-2051`) + poll `ai.interactions.get`; edit input = Files-API upload ≤10s/≤256MiB; stateful via owned `previousInteractionId+previousJobId` | Callable returns `resultUri` (`VideoRemixService.ts:21-58`) |

Provider config wired in Path A (`gateway.ts:1030-1046`): aspectRatio (**16:9/9:16 only**, hard reject `:1522-1527`), duration, resolution, negativePrompt, seed, enhancePrompt, personGeneration, `lastFrame`, `referenceImages` (max 3, Lite rejected `:1529-1536`), and flag-gated temporal inpaint (`GEMINI_VEO_TEMPORAL_INPAINT_ENABLED`, `:412` — **unset ⇒ always rejected**). Schema `packages/shared/src/schemas/creative.ts`: `GenerateVideoSchema` (frames, masks, `inputManifest` roles `first_frame|last_frame|ingredient|character_reference|whisk_reference`, resolution `720p|1080p|4k` default 720p, duration 4–8) and `GenerateOmniRemixSchema` (4 tasks, `storyboard ≤12` timecoded frames, duration 3–10, `audioUri` **present but rejected** at `gateway.ts:1973-1976`, `previousInteractionId/previousJobId` superRefine `:100-182`, extras `beatPulse/posePreservation/lyricsText/typographyStyle/visualizerColor`).
Normalizers `packages/shared/src/schemas/creativeNormalizers.ts`: duration **4|6|8 s only, forced 8 s when resolution ≠720p or any frame input** (`:22-32`); Lite 4k→1080p demotion (`:18`); aspect coerced 16:9/9:16.
Client receives via Firestore snapshots + gs://→URL resolution + integrity guards (`VideoGenerationService.ts:379-516`).

### 1.3 Audio ingestion + analysis (what really measures the beat)

- **Canonical masters:** byte-level WAV/FLAC validation (`services/audio/MasterAudioValidation.ts:30-86`, ≥44.1kHz/16-24-bit/stereo), hash-addressed Storage `masters/{uid}/{sha256}/original.{wav|flac}` (`MasterAudioService.ts:35-37`), orchestration `TrackIngestionService.ts:21-70`.
- **Server DSP (authoritative):** `packages/engine-dsp/pipeline.py:389-441` — librosa `beat.beat_track` (`:416-419`) → `tempoBpm`, `beatCountFirstTenMinutes` (**a COUNT — beat timestamps are NOT persisted**), RMS/peak/clipping/ZCR/transient energy. FastAPI `/profile` (`engine-dsp/main.py:53-71`), invoked via Cloud Tasks from `distribution/ingestion.ts:200-231`. Client receipt: `AudioAnalysisReceiptService.ts:9-31` (`openSourceProfile.tempoBpm` → `technical.bpm`, `AudioIntelligenceService.ts:91-130`).
- **Client DSP is heuristic only:** Essentia.js was **removed for CSP** (`AudioAnalysisService.ts:19-24`); what runs is hand-rolled Web Audio — RMS windows, "Hook candidate" segments (`:213-230`), **crude tempo clamp 70–180** (`:288-316`), ZCR-chroma key guess (`:329-366`). No onsets/downbeats. YAMNet = dormant Python script only (`execution/audio/audio_analysis.py:213,267-300`; zero TS references). Browser analysis of raw masters **throws by design** (ISSUE-962, `AudioIntelligenceService.ts:205-215`); semantic pass = FFmpeg 64kbps MP3 proxy → Gemini (`:278-341`, produces `targetPrompts.veo`/`image`).
- **Existing BPM→visual planning:** `PerformanceVideoService.ts` — `sonicProfileFromAnalysisReceipt` **throws without a measured BPM** (`:44-58`), `planScenes` slices the song into **8-bar scenes** (`:196-222`), `buildTimelineProject` lays equal-length Veo clips + the canonical master audio clip into an `IndiiVideoProject` (`:269-348`).
- **Dead sync code:** `VideoIngestionPipeline.ts:12-75` defines `transientTimestamps` snapping — no production caller, nothing produces timestamps. `beatPulse` is a **static CSS glow slider** (`creativeControlsSlice.ts:103,267` → `OmniWorkflow.tsx:731,787`), not audio-reactive. `ThreeSceneBuilderService.generateAudioResponsivePath` is a hardcoded TODO stub (`:76-88`).

### 1.4 Render + editor stack (no Remotion anywhere)

- **Remotion is fully removed** and guarded by a test asserting zero references (`services/video/__tests__/RenderService.test.ts:133-148`; parity signoff `docs/video/remotion-migration/PARITY_SIGNOFF.md`). CLAUDE.md/README stack tables are stale on this.
- **Project model:** `packages/shared/src/types/videoProject.ts` — `IndiiVideoProject/IndiiVideoClip` (transforms, transitions, keyframes `{prop:[{frame,value,easing}]}`, µs trims, `canonicalMaster`).
- **Compiler:** `packages/video-compiler/src/compiler.ts` — `IndiiVideoProject` → deterministic HyperFrames HTML + one paused GSAP timeline (MIG-008/ADR-001).
- **Routing:** `packages/shared/src/types/videoRoute.ts` — `planRenderRoute`: `direct_media` (FFmpeg: trim/transcode/audio_replace/thumbnail) vs `composed_visual` (composition engine).
- **Desktop:** IPC `video:render`/`video:compile-preview` (`main/src/handlers/video.ts:181-233,142`); `ElectronRenderService.ts:87-170` (FFmpeg fast path via `MediaJobExecutor`, or compile + vendored CLI via `HyperFramesAdapter.ts:102-137`). FFmpeg bins `MediaOps.ts:16-29` (probe/trim/transcode/audio-replace/thumbnail **only — no scale/upscale op today**).
- **Cloud:** callable `renderVideo` (`index.ts:758-1008`) — dims ≤4096×2160, fps 1–60 (`:838-839`); **refuses `composed_visual` on cloud** ("Cloud composition rendering is not active yet", `:872-878`); Inngest `video/stitch.requested`; Cloud Run worker exists but is `RENDER_WORKER_URL`-gated (`dispatchCloudVideoRender.ts:17-65`; `packages/render-worker/`). Single client entry: `LocalVideoProjectRenderer.ts:75-141` (desktop local, else cloud queue+poll).
- **Preview-vs-render split exists** (compiled HTML preview vs full render) but **no low-res draft tier and no upscaling** anywhere.
- **Editor:** `modules/creative/video/editor/` (timeline, clips, keyframes, snap/loop/undo, `AudioWaveform` canvas peaks via `utils/audioPeaks.ts`, `VideoEditorSidebar` 1080p presets only); user-drawn keyframes only — never audio-derived.

### 1.5 Scene extension reality (item 12)

- **Working:** server long-form daisy-chain (Path C) — sprite-sheet last-frame continuity + Transcoder stitch + master audio; UI daisy-chain flags (`StoryboardTimeline.tsx:614-618`, `VideoDaisychain`), `FrameSelectionModal`, `VideoJsPlayer.captureFrame()` (canvas JPEG, `VideoJsPlayer.tsx:68-87`), persisted frame handoffs (`CreativeMediaHandoffService.ts:9-30`).
- **Dead at runtime:** `packages/renderer/src/services/video/SceneExtensionService.ts` (394 lines: `createExtendedVideo` 8s×10 chained segments, `extendVideo(uri, prompt, additionalSeconds)`) calls `AI.generateVideo` → the **hard-disabled** client path ⇒ throws. Its test mocks the throw away.
- **Does not exist:** Veo-native extension — `VideoJobSchema.inputVideo` ("For video extension", `video.ts:69`) is a dead field no worker consumes; agent tool `extend_video` fakes it via frame extraction + re-generation (`VideoTools.ts:303-325`); provider rationale documented (`docs/GEMINI_OMNI_INTEGRATION.md:27`).

### 1.6 Omni↔Veo↔editor handoffs + chat loop (built)

`docs/GEMINI_OMNI_INTEGRATION.md`: Veo→Omni edit; Image→Omni first-frame/reference; Image→Veo first/last/reference; Omni→Veo via persisted final-frame; videos→timeline clips; Omni→Image Studio. Shared drag payload `application/x-indii-creative-asset+json`. Chat: `generate_image` with reference indices + seed in an 8-iteration BaseAgent tool loop (`DirectorTools.ts:84-190`, `BaseAgent.ts:964-994`); `consult_specialist` A2A (`SwarmTools.ts:11-23`); inline annotator edits existing image artifacts (`EditImageWithAnnotationsTool.ts:113-190`); Firestore-persisted sessions (`SessionService.ts:29-136`). Chat-side video editing intentionally out of scope (`docs/CHAT_IMAGE_INTERACTION_PLAN.md:239`) — conversational video editing lives in OmniWorkflow `edit` mode (satisfies item 2).
Reference stack: Character Library 3-slot `subject|style|reference` (`CharacterLibrary.tsx:45,169,195` → `character_reference` role `directVideoInputs.ts:32`), Likeness ≤5 quality-scored (`LikenessService.ts:1-21`), Whisk precise (`WhiskService.ts:129-169`), brand-kit refs. No seed lock/reuse; no character-bible store (skills' camera grammar is prompt-doc only).

### 1.7 Pricing reality (three divergent tables + dead knobs)

- `packages/firebase/src/config/pricing.ts:6-22`: PRO $0.20/s (720p/1080p), $0.40 4K, audio add-ons; FAST $0.10/$0.30; LITE $0.05.
- Gateway V3 **own rates** `gateway.ts:403-409`: pro $0.40/s, fast $0.10/s, lite $0.05/s, ×1.35 temporal_inpaint, ×1.2 long_form. Omni ≈ fast rate (doc says ≈$0.10/s).
- Renderer accounting `ModelPricing.ts:98-106` (pro $0.40, **fast $0.15**, lite $0.10) + another copy `intelligence-models.ts:131-159`. Client estimator `VideoGenerationService.ts:83-94`.
- Reservations: `CostControlService.checkAndReserve` → `costLedger` → `loadCostReservation` (`gateway.ts:418-447`) → settle/void (`:1085-1092,1145-1157`). Entitlements are **minutes, not credits**: FREE 5 min/720p/15s-per-job; PRO 30 min/1080p/60s; PREMIUM 120 min/4K-label/300s; STUDIO unlimited (`SubscriptionTier.ts:104-259`). "Credits" are display-only (`CostPredictor.ts:27` ×1000). **No purchasable video-credit ledger exists.**
- Dead knobs: long-form still sends `generateAudio` (`long_form_video.ts:300`); `audioAddOn` prices in `pricing.ts` — Veo 3.1 audio is always-on, no param exists (`shared/src/types/ai.dto.ts:192,202`).

### 1.8 Context/payload ceilings (item 3 ground truth)

No `1048576`/1M/`maxInputTokens` config exists anywhere. Real ceilings: server stream guard ≤200,000 serialized chars, 1–32 parts, HTTP 413 (`packages/firebase/src/index.ts:1326-1335`); client mirror `StreamPayloadGuard.ts:31-164` (JPEG ladder 1024→768→512, `PAYLOAD_TOO_LARGE` pre-flight); server output clamp FREE 1,024 / PAID 8,192 (`textStreamAdmission.ts:3-14`); Omni prompt ≤4,000 chars + storyboard ≤12 frames (`creative.ts:72,80`); history = last 20 messages (`AgentService.ts:1511-1520`) or 15/25 summarized turns (`HistoryManager.ts:18-20`). **Latent mismatch:** `BaseAgent.ts:1111` assumes a "2M token context window" (1.5M-token ceiling) — unreachable on the stream path and wrong for 1M-class models.

### 1.9 Provider constraints (do not fight these)

Omni: no uploaded-audio references, no extension, 720p out, 3–10s, SynthID always, uploaded-video edit EEA/CH/UK-blocked, 55-day interaction retention (`docs/GEMINI_OMNI_INTEGRATION.md` §Deliberate limitations). Veo: 4/6/8s (8s forced >720p or with frame inputs), refs max 3 (Fast/Pro), 16:9/9:16 only, no native extension wired. `gemini-omni-1.1-flash` does not exist in Google's current model list (per loaded Gemini-API skill); if it ships, change `FUNCTION_INTELLIGENCE_MODELS.VIDEO.OMNI` / `GEMINI_OMNI_FLASH_MODEL` only.

---

## 2. Workstreams (execute in this order)

Repo law for every task: Error Ledger check before debugging; Platinum standards before push;
no mocks for real-user claims (`.agent/REAL_USER_AUTHENTICITY.md`); no infrastructure IDs in
renderer (CLAUDE.md §11); model/pricing IDs only via registry surfaces; isolated npm cache if
an install is ever needed (`--cache ./.npm-cache-isolated-$$`); verify `git status` scope
before committing (concurrent sessions are active in this repo).

### WS-1 — Model surface honesty + capability registry (items 1, 3) — SMALL

**T1.1 Add `OMNI_CAPABILITIES` to `packages/firebase/src/config/models.ts`**, mirroring `NANO_BANANA_CAPABILITIES`: tier `preview`, `maxResolution: '720p'`, `supportedDurations: [3..10]`, `maxReferenceImages: 8`, `supportsAudioReference: false`, `supportsExtension: false`, `supportsStatefulEdit: true`, `synthIdAlwaysOn: true`. Provider changes then touch only this object.
- Accept: unit test pinning the registry against `GenerateOmniRemixSchema` limits (8 refs, 3–10s) so drift fails CI.

**T1.2 Context-ceiling audit + doc (item 3).** Append a "Context and payload ceilings" section to `docs/GEMINI_OMNI_INTEGRATION.md`: the §1.8 list with file:line, plus which cap binds first for (a) chat, (b) storyboard→video, (c) long-form structural input. Flag the `BaseAgent.ts:1111` "2M window" assumption as a documented latent mismatch (models are 1M-class); propose the one-line fix, do not silently change behavior in the same commit.
- Accept: doc merged; no unexplained behavior change.

### WS-2 — Stateful editing verification (item 2) — SMALL

Implemented: Omni `edit` + owned `previousInteractionId/previousJobId` verification (`gateway.ts:1766-1786,1979-1981,2047`).
**T2.1 Region-gating audit:** locate the EEA/CH/UK uploaded-video-edit gate (search `gateway.ts`/`legacyAdmission.ts` for region checks). If absent, implement server-side on `edit` + `referenceVideoUri` (stored-interaction edits stay allowed). No region lists in renderer.
**T2.2 Tests** in `gateway.test.ts`: stateful chain edit→edit→edit; cross-user interaction id rejected; EEA simulation rejects uploaded-source edit, passes stored-interaction edit.
- Accept: `npx vitest --run packages/firebase/src/functions/creative/gateway.test.ts` green.

### WS-3 — Audio-Visual Sync (item 4) — **FLAGSHIP**

Build **analysis-driven timing + final mux + DSP alignment** from parts that already exist:

```
[user master] → server librosa BPM (today: tempoBpm only, NO beat timestamps)
             → extend engine-dsp to persist beat timestamps (librosa already computes them)
             → StoryboardTimeline bar grid from MEASURED bpm (today: stubbed 120)
             → bar-quantized segment boundaries (today: fixed 5s blocks / server 4|6|8 recalc)
             → long-form daisy-chain generation → Transcoder stitch muxes THE SAME master
             → alignSessionMaster drift QA + audio recipe LUFS finishing (exists)
```

**T3.1 Persist beat timestamps in the DSP receipt.** `packages/engine-dsp/pipeline.py` `build_open_source_profile` already calls `librosa.beat.beat_track` (`:416-419`) but stores only a count. Add `beatTimestampsSec: number[]` (rounded to ms, capped ~first 10 min) and an optional coarse `energySegments[]` (reuse the block transient energy already computed). Thread through FastAPI `/profile` (`main.py:53-71`) → `distribution/ingestion.ts:200-231` → shared receipt type (extend `@indii/shared` schema + `AudioAnalysisReceiptService.ts:9-31` client type). Backward compatible: absent field = old receipts.
- Accept: engine-dsp test fixture asserts monotonic timestamps within track duration; client type test accepts receipts with and without the field.

**T3.2 Wire MEASURED BPM into the storyboard grid.** `StoryboardTimeline.tsx:187-219` imports local audio and stubs 120 BPM. Instead: resolve the track to an analyzed profile (fingerprint → `users/{uid}/analyzed_tracks/{hash}` via `MusicLibraryService.ts:52-53`, or run `audioIntelligenceSlice.analyzeAudio` on ingest) and populate `StoryboardProject.bpm`/`key` from `technical.bpm`. For uploads that are not canonical masters, still accept `audio/*` locally but mark the grid "estimated" until a server profile exists. Replace toasts at `:212`/`:496`. Follow the `PerformanceVideoService.sonicProfileFromAnalysisReceipt` precedent (throws without measured BPM, `:44-58`).
- Accept: unit test — 96 BPM receipt ⇒ grid 96, slots on bars; unanalyzed file ⇒ editable grid labeled estimated; UI test mirrors `StoryboardTimeline.render.test.tsx`.

**T3.3 Bar-quantize long-form segments (both sides).** Client `BLOCK_DURATION = 5` (`VideoGenerationService.ts:569-573`) and server recalc `totalDuration/prompts.length` default 5 (`long_form_video.ts:156,279-285`) are off-grid. Add optional `bpm` to `LongFormVideoJobSchema`; compute `segmentDuration = clamp_to_legal(4 * 60/bpm)` over {4,6,8} (mirror `normalizeVideoDuration`, 8s forced >720p). Fallback 5s when bpm absent. Keep old jobs valid.
- Accept: `triggerLongFormVideoJob.quota.test.ts`-style tests — 120 BPM ⇒ 8s; legacy no-bpm jobs parse.

**T3.4 Beat-accurate storyboard→Omni + revive transient snapping.** Convert slot bars → `timestamp` seconds (`startBar * 4 * 60/bpm`) in the Omni timecoded storyboard (schema-valid today); `beatPulse` stays a prompt-intensity dial but its label/copy reflects that it modulates downbeat phrasing, not measured audio. Feed `beatTimestampsSec` into the dormant `VideoIngestionPipeline` transient snap (`:63-75`) as the production caller for clip-start snapping.
- Accept: `OmniWorkflow.test.tsx` timestamp math for a 96 BPM fixture; `VideoIngestionPipeline.test.ts` gains a production-path test.

**T3.5 Sync QA via existing alignment, not new plumbing.** Extend the render receipt (`getVideoRenderReceipt.ts`) with `masterAudioSync: { alignmentStatus, driftPpm, segmentDurations }` sourced from `alignSessionMaster` output when present; no new mux/alignment logic.
- Accept: `stitchMasterAudio.test.ts` + `getVideoRenderReceipt.test.ts` extended.

**Non-goal:** sending user audio bytes to Omni/Veo. Keep the `gateway.ts:1976` rejection; improve its copy to point at the storyboard-sync path.

### WS-4 — Resolution tiers + pricing honesty (items 5, 6, 7)

**T4.1 Draft tier (360p-class).** Provider floors at 720p ⇒ model draft as a pipeline tier, not a resolution lie:
- Add `tier: z.enum(['draft','standard']).default('standard')` to both video schemas; server maps `draft` → `veo-3.1-lite-generate-001`, 720p, min duration.
- Optional true 360p proxy: `planRenderRoute` `direct_media` already routes FFmpeg transcode — extend `MediaJobExecutor` ops with a `scale` transcode preset for review proxies (desktop + cloud-stitch outputs). Never label a proxy "final".
- UI: tier toggle in `VideoWorkflow.tsx` studio controls ("Draft (fast, low-credit)" vs "Final").
- Accept: gateway test (draft ⇒ lite + 720p + reduced estimate); UI toggle test; FFmpeg op test for the scale preset.

**T4.2 Consolidate the three pricing tables (prerequisite for honest tier pricing).** Single source: keep `packages/firebase/src/config/pricing.ts` as canonical; `gateway.ts:403-409` imports it; reconcile `ModelPricing.ts:98-106` + `intelligence-models.ts:131-159` + client estimator `VideoGenerationService.ts:83-94` to read one shared table (`@indii/shared` export). Remove dead knobs: `generateAudio` in `long_form_video.ts:300`, `audioAddOn` rows in `pricing.ts` (Veo 3.1 audio is always-on). Mode multipliers (×1.2 long_form, ×1.35 temporal_inpaint) stay in one place.
- Accept: one shared pricing module; unit tests assert the three consumers agree; grep shows no duplicated rate literals.

**T4.3 720p mobile download verification.** `OmniWorkflow.tsx:613` (`downloadAsset`), `VideoWorkflow.tsx:139` (Electron), editor "Download MP4"/"Render Video" (`VideoEditor.tsx:284-295`), cloud path = `renderVideo` queue+poll (`LocalVideoProjectRenderer.ts:75-141`; web/mobile cannot render locally — by design). Verify on a real mobile browser per REAL_USER_AUTHENTICITY: download a real 720p output; confirm filename, no CORS block. iOS Safari fallback = existing share pattern (`grep -rn "navigator.share" packages/renderer/src`).
- Accept: §7 verification note + structure-only e2e spec extension; real-click coverage stays manual/Antigravity.

**T4.4 1080p/4K: prove, then cap honestly.** Facts: resolution reaches Veo (`creativeNormalizers.ts:4-20`), but the UI **silently degrades 4K→1080p** with "4K is not yet supported for video" (`useDirectGeneration.ts:428-431`; chips `DirectGenerationTab.tsx:374-380`; dropdown HD/FHD-only `StudioControlsPanel.tsx:1050-1055`); cloud render admits ≤4096×2160 (`index.ts:838-839`); FFmpeg has no scale op. Steps: (1) verify live what `veo-3.1-generate-001`/`-fast` accept for `4k`; (2) if unsupported: keep the honest 1080p cap in the registry, and — only if the founder wants a 4K deliverable — add an **upscale transcode preset** (FFmpeg scale via `direct_media`, or Transcoder) labeled "upscaled", plus a 4K editor preset (`VideoEditorSidebar.tsx` has 1080p only) gated on that path; (3) remove the silent toast in favor of explicit tier gating from the registry/entitlements (`SubscriptionTier.ts` already carries per-tier `maxResolution`).
- Accept: normalizer tests per model; §7 provider-verification note; no fake "4K" label anywhere.

### WS-5 — Scene extension to 40s in 10-second increments (item 12)

Veo-native extension does not exist and must not be chased (`inputVideo` dead field, `docs/GEMINI_OMNI_INTEGRATION.md:27`). One mechanism, server-first:

**T5.1 Make the long-form daisy-chain the single extension engine.**
- Add `ExtendVideoSchema` (sourceJobId, targetSeconds ∈ {10,20,30,40}) to `shared/creative.ts`; server maps target → segment plan over legal durations (e.g., 40s = 5×8s at 720p+), reusing Path C: sprite-sheet continuity + stitch + master audio.
- Ask the founder before deleting `SceneExtensionService.ts` (394 lines, dead at runtime, asset-pruning fail-safe applies). Preferred alternative if kept: rewire its two public methods to `VideoGenerationService.generateVideo` (gateway) as thin wrappers over the same server plan. Either way, delete the dead client `AI.generateVideo` dependency.
- Unify the `extend_video` agent tool (`VideoTools.ts:303-325`, frame-regen fake) onto the same server plan.
- Accept: gateway tests — 40s target ⇒ 5 chained segments + one stitch request; Omni-source handling matches the documented provider rule; quota tests updated (`triggerLongFormVideoJob.quota.test.ts` style).

**T5.2 UI + README truth.** "+10s/+20s/+30s/+40s" on dailies (`DailiesStrip.tsx`/`DailyItem.tsx`) and storyboard slot menu (`StoryboardTimeline.tsx`); `modules/creative/video/README.md` documents which path owns which job (single-clip extend vs multi-slot continuity vs full long-form).
- Accept: interaction test in the `VideoDaisychain.interaction.test.tsx` style; README section.

### WS-6 — Storyboard-to-video end-to-end (item 13)

**T6.1 One-click "Render film from storyboard".** Route through the **server long-form/stitch path** (works today) — NOT cloud `renderVideo` composed (refused, `index.ts:872-878`) and not the dead client service. Orchestrator: per slot → Path-A/C segment (Veo with slot frames/refs; Omni where chosen), honoring `useDaisyChain` (previous slot final frame as `firstFrameUri`) → collect `resultUri`s → `video/stitch.requested` with the loaded track as master audio → receipt with `masterAudioSync` (T3.5). Per-slot progress in `StoryboardTimeline` (dailies status pattern). Screenwriter handoff (`handoff.ts:50-71`, `ScreenwriterDashboard.tsx:293-408`) and `generate_storyboard` (`VideoAgent.ts:44-48`) feed the same slots.
- Accept: integration test with mocked callables asserting call order + continuity payloads; manual real-render verification recorded in §7.

**T6.2 Persist the storyboard project (cheap hardening).** Zustand-only today (`videoEditorStore.ts:364-408`) — a refresh loses the film plan. Persist to Firestore under the user's creative namespace (pattern: `CreativeSessionService.ts:22`), rehydrate on load.
- Accept: store round-trip test (slots, bpm, daisy-chain flags survive).

### WS-7 — Documentation truth sweep (housekeeping, small, founder-visible)

- CLAUDE.md/README stack tables are stale: Remotion → **HyperFrames** (`@hyperframes/player`, `packages/video-compiler`); Essentia.js → **removed (CSP)**; YAMNet → **dormant**. CLAUDE.md edits must be mirrored to GEMINI/DROID/JULES/CODEX/ANTIGRAVITY per its header — get founder sign-off.
- Docs citing retired `veo-3.1-generate-preview`: `docs/RULES.md:40`, `docs/MODEL_POLICY.md:122`, `docs/GEMINI.md:16`, `docs/BACKEND_ARCHITECTURE.md:51`, `docs/flowcharts/video-studio-pipeline.md:30,85`, `docs/THREE_TIER_STRATEGY.md:1284` → update to GA `-001` IDs.
- Accept: grep for `veo-3.1-generate-preview` returns docs-hits zero (code already clean); stack tables match reality.

---

## 3. Execution order & dependencies

```
WS-1 (registry/audit) ─┐
WS-2 (stateful verify) ├─ independent, cheap, first
WS-4.2 (pricing single-source) ─┘ (T4.1 depends on it)
WS-3 (audio sync)     → flagship; T3.1 → T3.2 → T3.3 → T3.4 → T3.5
WS-5 (extension)      → after WS-4.4 (resolution rules settled)
WS-6 (storyboard e2e) → after WS-3 + WS-5
WS-7 (doc sweep)      → anytime; batch with the commit above it
```

Commit sequence (one coherent scope per commit, `git push origin HEAD:main`):
1. WS-1 + WS-2 (+WS-7 doc truth).
2. WS-3 T3.1+T3.2 (DSP timestamps → grid).
3. WS-3 T3.3+T3.4+T3.5 + WS-4.2 (bar-quantize + pricing single-source).
4. WS-4.1 + WS-4.4 + WS-5 (draft tier, resolution honesty, extension).
5. WS-6 (+T6.2) — end-to-end storyboard film.

## 4. Verification protocol (per commit and at the end)

- `npx vitest --run <touched test files>` first; then `npm test -- --run` (full suite green).
- `npm run typecheck`, `npm run lint`.
- Functions/engine-dsp-touched commits: run `packages/firebase` vitest suite; engine-dsp changes need their Python test fixture run (`packages/engine-dsp`).
- Before push: `/plat` (Platinum checklist + Error Ledger cross-reference). After any merge: merge-hygiene duplicate/prop grep.
- Real-user claims (draft cost, mobile download, storyboard film render): deployed app + genuine account only (`.agent/REAL_USER_AUTHENTICITY.md`).
- Live-provider checks (Veo 4k, Omni alias): server-side with `GEMINI_API_KEY`/ADC or provider docs — never renderer-hardcoded. Existing harness scripts: `scripts/test_veo.ts`, `scripts/generate-first-last-video.ts`.

## 5. Risks / non-goals

- Do not build provider-unsupported features "because the checklist says so": Omni audio input, Veo-native extension, provider 360p. Model as tiers/bridges (WS-3/4/5) or the plan is dishonest.
- Cloud `composed_visual` render is **disabled by design** (`index.ts:872-878`); storyboard films must ride the long-form/stitch path (T6.1), not HyperFrames cloud.
- Do not revive client-side DSP: Essentia.js was removed for CSP; server engine-dsp is the analysis path. YAMNet stays dormant unless the founder asks.
- `SceneExtensionService.ts` deletion requires founder ask-first (asset-pruning fail-safe); rewiring is the default.
- EEA/CH/UK uploaded-video edit restriction is compliance (T2.1). SynthID always-on, recorded (`synthIdAppliedByProvider`), no toggle. 55-day interaction retention → flag founder before data-policy changes.
- Legacy Path B (merch) silently ignores seed/negativePrompt/frames — do not extend it; new features go through gateway V3.
- Concurrent sessions are active in this repo: re-run `git status --short` immediately before staging; path-scope every commit; never stage others' files.

## 6. Checklist → task map (traceability)

| Checklist item | Tasks |
|---|---|
| 1 Omni model API | exists (§1.1); T1.1 |
| 2 Stateful Interactions API | exists (§1.2 Path D); T2.1, T2.2 |
| 3 1,048,576-token context | T1.2 |
| 4 Audio-Visual Sync | **T3.1–T3.5** |
| 5 360p draft | T4.1 (+T4.2 pricing) |
| 6 720p mobile download | T4.3 |
| 7 1080p/4K | T4.4 |
| 8 Start/End frames | exists (§1.2) — no task |
| 9 Text-to-video shot controls | exists (§1.2) — no task |
| 10 Image-to-video | exists (§1.2) — no task |
| 11 Reference-to-video | exists (§1.2, §1.6) — no task |
| 12 Scene extension → 40s | T5.1, T5.2 |
| 13 Storyboard-to-video | T6.1, T6.2 |

## 7. Current state (update before session end)

- 2026-08-28: Plan written from read-only audit + three research-agent sweeps (video generation; audio/render; chat/storyboard). No implementation started. Worktree at last check: `main`, clean except `.agent/observations/2026-08-27-agent-watch.md` (foreign) + untracked `videos/` — a concurrent session landed the video.js player work (`3523cfbe3`) mid-audit; re-verify `git status` before staging.
- **Push blocker at plan time:** local `main` sat 3 commits ahead of `origin/main` from a concurrent session (unpushed, unvalidated by me) with a foreign file staged (`OPEN_ISSUES_V3.md`). Per `branch-safety.md` this session committed the plan doc path-scoped and did NOT push — delivering `HEAD:main` would have shipped the foreign commits. Whoever owns those 3 commits pushes first; this doc rides with that push (or the founder directs it).
- Live-provider facts still unverified: Veo `4k` acceptance for GA `-001` models (T4.4 step 1); `gemini-omni-flash-preview` currency (T1.1 registry makes flips one-line).
- Engine-dsp beat-timestamp persistence (T3.1) is the first code change of the flagship — nothing depends on it until T3.2.
