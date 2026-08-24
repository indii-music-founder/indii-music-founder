# Remotion → HyperFrames Migration: Phase 1 Inventory

> Working artifact for the video-rendering engine migration.
> Goal (per architecture directive): indii.music owns the project model, editor semantics,
> AI interface, routing and renderer contracts. FFmpeg = media engine. HyperFrames =
> composition engine. **Remotion: gone** — last, not first.

## Status

- [x] Full repo sweep completed (source, build config, backend, scripts, env, docs, agents, tests)
- [x] ADR written superseding 2026-06-26 "keep Remotion" decision → [ADR-001](./ADR-001-video-engine-abstraction.md)
- [x] HyperFrames LICENSE verified (Apache-2.0)
- [x] `IndiiVideoProject` promoted to `packages/shared`
- [x] `VideoRendererContract` / `RenderPlanner` boundaries introduced
- [x] Local HyperFrames adapter behind boundary
- [x] FFmpeg direct-path executor
- [x] General project compiler + one standalone LogoReveal port
- [x] Golden render harness calibrated and structurally gated
- [x] Preview moved to the seekable HyperFrames Player; rendered artifact is fallback/delivery
- [ ] Cloud Run composition path implemented/deployed (Firebase fails closed until approval)
- [x] Agent skills and MCP surface re-pointed at engine-neutral APIs
- [x] Remotion packages/config/env/scripts deleted
- [x] Production import/config/tool-name sweep passes; migration history remains searchable by design

---

## 1. Packages before removal (npm)

| Package | Version | Declared in |
|---|---|---|
| `remotion` | 4.0.484 | `packages/renderer/package.json` |
| `@remotion/bundler` | 4.0.484 | `packages/renderer/package.json` |
| `@remotion/media-utils` | 4.0.484 | `packages/renderer/package.json` |
| `@remotion/player` | 4.0.484 | `packages/renderer/package.json` |
| `@remotion/renderer` | 4.0.484 | `packages/renderer/package.json`, `packages/main/package.json` |
| `@remotion/cloudrun` | 4.0.484 | transitive (used by `scripts/deploy-cloudrun.ts`, externalized in renderer vite config) |

Motion Canvas / Revido: **not present anywhere** (package manifests, lockfile, source). Nothing to migrate; audit closed trivially.

FFmpeg surface (KEEP): `ffmpeg-static` + `fluent-ffmpeg` in root, `packages/firebase`, `packages/main`; `fluent-ffmpeg` in `packages/mcp-server-local`.

video.js (KEEP): playback/buffering layer only. `packages/renderer/package.json`.

## 2. Renderer source before removal (composition + preview)

| File | Role |
|---|---|
| `packages/renderer/src/remotion/index.ts` | `registerRoot(RemotionRoot)` — bundle entry point |
| `packages/renderer/src/remotion/Root.tsx` | Registers ALL compositions (VideoProject, LogoReveal variants) |
| `packages/renderer/src/remotion/render.ts` | Local/bundle render helper |
| `packages/renderer/src/remotion/LogoReveal.tsx` | LogoReveal composition(s) |
| `packages/renderer/src/remotion/BannerAnimations.tsx` | Banner compositions (~730 lines) |
| `packages/renderer/src/modules/creative/video/remotion/Root.tsx` | Second Remotion root (module-scoped) |
| `packages/renderer/src/modules/creative/video/remotion/MyComposition.tsx` | VideoProject composition |
| `packages/renderer/src/modules/creative/video/editor/components/VideoPreview.tsx` | `<Player />` preview (PlayerRef, seek/play control) |
| `packages/renderer/src/modules/creative/video/editor/hooks/useVideoEditor.ts` | Player control hooks |
| `packages/renderer/src/modules/creative/video/editor/VideoPopout.tsx` | Popout player surface (+ test) |
| `packages/renderer/src/modules/creative/video/editor/components/AudioWaveform.tsx` | `@remotion/media-utils` waveform visualization (+ test) |

## 3. Services layer

| File | Role | Migration note |
|---|---|---|
| `packages/renderer/src/services/video/RenderService.ts` | Cloud render client over Firebase callable; framework-neutral **receipt protocol** (`renderId/projectId/progress/asset/expiresAt`) | **KEEP the contract.** Swap implementation details only |
| `packages/renderer/src/services/video/VideoRenderOrchestrator.ts` | Bridges RenderService ↔ BackgroundJobsSlice | KEEP; engine-agnostic already |
| `packages/renderer/src/services/video/remotion-mock.ts` | Browser-safe stubs for `renderMediaOnCloudrun`/`renderMedia`/`selectComposition` | DELETE with engine |

## 4. Electron main process

| File | Role |
|---|---|
| `packages/main/src/services/ElectronRenderService.ts` | Local render via dynamic `import('@remotion/renderer')` → `renderMedia`, bundle from `REMOTION_BUNDLE_PATH` (default `./dist/remotion-bundle`). Known debt: ISSUE-344 type bypass |

## 5. Firebase backend

| File | Role |
|---|---|
| Retired engine-specific MCP render tool (+ test, + export) | Replaced by engine-neutral `queue_video_render` |
| `packages/firebase/src/lib/canvas_render.ts` | Canvas MP4 composer tied to that tool |
| `packages/firebase/src/functions/creative/gateway.ts` | Video job gateway (engine-agnostic admission) — verify no remotion leakage |

## 6. Build configuration (⚠️ lockstep removal required)

Both configs alias and chunk Remotion; removing one without the other breaks the build:

- `electron.vite.config.ts` L225, L343–344 (`vendor-remotion` chunk), L398 (alias `@remotion/renderer` → `remotion-mock`)
- `packages/renderer/vite.config.ts` L153 (alias), L186 (chunk predicate), L206–207 (`optimizeDeps.exclude`: `@remotion/renderer`, `@remotion/cloudrun`), L281–282 (chunk)
- Known open issue: ISSUE-475 scheduler duplication in `vendor-remotion` vs `vendor-react` (moot post-migration)

## 7. Environment variables (.env.example L200–206)

```
VITE_REMOTION_BUNDLE_PATH
VITE_REMOTION_SITE_NAME        # default 'indii-os-remotion-site'
VITE_REMOTION_SERVICE_NAME
VITE_REMOTION_GCP_REGION       # default us-central1
VITE_REMOTION_GCP_PROJECT_ID
```

Created via `npx remotion cloudrun sites create …`. GCS-hosted site + Google auth. Replacement must keep: GCS hosting, Cloud Run region/service naming, ADC auth.

## 8. Scripts & deployment tooling

| File | Role |
|---|---|
| `scripts/deploy-cloudrun.ts` | `deploySite()` from `@remotion/cloudrun` → GCS; entry `packages/renderer/src/remotion/index.ts` |

## 9. Project model (seed of IndiiVideoProject)

`packages/renderer/src/modules/creative/video/store/videoEditorStore.ts`:

```ts
export interface VideoProject {
    id: string; name: string;
    fps: number; durationInFrames: number;
    width: number; height: number;
    tracks: VideoTrack[]; clips: VideoClip[];   // ClipType: video|image|text|audio
}
```

- Already ~framework-neutral BUT carries Remotion vocabulary (`durationInFrames`, frame-based timing) alongside µs precision (`sourceInUs/sourceOutUs`) and a compiler (`compileApprovalToTimeline`) producing deterministic timeline clips.
- Job schema: `packages/shared/src/schemas/videoJob.ts` (103 lines).
- **Action:** promote to `packages/shared` as `IndiiVideoProject` (rename Remotion-isms, keep µs as canonical time, frames derived per fps).

## 10. Tests touching Remotion (13 files)

- `services/video/__tests__/RenderService.test.ts`
- `modules/creative/video/store/videoEditorStore.compiler.test.ts`, `store/videoEditorStore.test.ts`
- `editor/VideoPopout.test.tsx`, `editor/components/AudioWaveform.test.tsx`
- plus storyboard/render project tests under `modules/creative/video/`

Golden-parity harness target: same `IndiiVideoProject` through LEGACY (Remotion) and NEW (HyperFrames+FFmpeg); compare duration, dimensions, frame samples, audio sync, visual diff.

## 11. Documentation & agent knowledge

- `docs/handoff/video-studio-implementation-brief.md` — "Render/composition layer: Remotion" (canonical brief)
- `docs/video-studio-implementation-plan.md`, `docs/video-editing-deep-dive.md` — original research recommending JSON timeline → Remotion Player (Pattern A)
- `agents/conductor/skills/video_producer/SKILL.md` L3, L29–31, L51 — agent SOP references Remotion assembly/audio-reactive
- `WORKSHEET.md` / `MASTER_WORKSHEET.md` Step 6 (Veo 3.1 + Remotion Studio)
- `.env.example`, `cspell.json`, `electron.vite.config.ts` comments
- Historical ledger entries (ISSUE-344, ISSUE-475, ISSUE-069 long-form parallel rendering) — archive-only

## 12. Prior decisions this migration supersedes

- **2026-06-26 (William):** "Do not hand-roll media buffering or replace Remotion's render/composition role with video.js."
  → Superseded by: replacement engine is HyperFrames (behind our boundary), not hand-rolled code; video.js remains playback-only. Record as ADR so coding agents don't revert.

## 13. Verification items

- [x] HyperFrames license terms — **Apache-2.0**, verified from repo LICENSE 2026-08-22 (ADR-001 addendum)
- [x] Cloud Run CLI (`0.8.10`) and published `@hyperframes/gcp-cloud-run` surface (`0.8.11`) confirmed
- [x] Remotion migration tooling — `/remotion-to-hyperframes` skill confirmed in-repo
- [x] Compiler/GSAP adapter maps project timing, effects, transitions, and keyframes and passes real CLI lint fixtures
- [x] Harness calibration and structural/SSIM gates implemented
- [x] Corrected cross-engine parity signed for the two retained subjects with provenanced baseline evidence
- [ ] Paid Cloud Run deployment, owner-scoped GCS round trip, and receipt smoke test

## 14. Current dependency placement

`hyperframes@0.8.10` is exact-pinned in `packages/main` and at the repository root.
The root declaration is an Electron Builder packaging requirement: production dependencies
are collected from the root manifest into `app.asar`. The Node engine remains absent from
the renderer manifest. The renderer exact-pins browser-safe `@hyperframes/player@0.8.11`
for live timeline playback; GSAP is emitted separately as a main-process render asset and
inlined into preview HTML by the trusted IPC compiler.

`skills-lock.json` contains 26 entries sourced from `heygen-com/hyperframes`, all rooted
only at `.agents/skills/`. The installer's byte-identical duplicate tree under `skills/`
was removed; that registry now retains only the unrelated proprietary skill.
