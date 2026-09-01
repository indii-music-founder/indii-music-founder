# Interactive 3D Stage Builder — ARCHIVED (2026-08-31)

**Removed from indii Studio at the founder's request** ("we don't need that").
The technology is saved here in case we want it later — e.g. the social media
website, or another surface.

## What it was
A drop-in 3D scene builder for custom music-video sets (PRODUCTION_200 item #105),
using `@react-three/fiber` + `@react-three/drei` (Three.js). Users dropped GLTF/OBJ
models onto a stage, adjusted lighting/camera, and the scene fed the video pipeline.

## Files
- `SceneBuilder.tsx` — the interactive 3D canvas component (was lazy-mounted in
  `VideoWorkflow` under `viewMode === 'visualizer'`).
- `sceneBuilderFiles.ts` — GLTF/OBJ file validation.
- `ThreeSceneBuilderService.ts` — scene-state orchestration service (was already
  unreferenced by the time of removal).
- `*.test.tsx.archived` / `*.test.ts.archived` — co-located tests (renamed so
  Vitest no longer discovers them; strip the `.archived` suffix to restore).

## Restore if needed
1. Move these files back under `packages/renderer/src/`:
   - `SceneBuilder.tsx` + `sceneBuilderFiles.ts` →
     `packages/renderer/src/modules/creative/video/visualizer/`
   - `ThreeSceneBuilderService.ts` → `packages/renderer/src/services/video/`
2. Re-add the `'visualizer'` value to `viewMode` in
   `packages/renderer/src/modules/creative/video/store/videoEditorStore.ts`.
3. Re-add the lazy import + entry button + render block in `VideoWorkflow.tsx`
   (see git history for the exact JSX).
4. Re-add `Layout` to the lucide import in `VideoWorkflow.tsx`.

## Note
The shared audio-visualizer 3D pieces (`components/shared/WaveMesh.tsx`,
`CanvasRenderer.tsx`, `AudioVisualizer.tsx`) are **not** part of this removal —
they stay in the app.
