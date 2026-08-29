# Creative Finalization Tools Plan — Living Document

> **Status:** Active — NOT STARTED. **Owner:** unassigned (designed for handoff to any executing agent, including lower-capability models).
> **Source of truth:** This file. When you start working, read it top-to-bottom; when you finish a phase, update **Section 19 (Current State)** and the phase checkboxes so the next agent picks up cleanly.
> **Created:** 2026-08-28 by Claude (planning session with founder William).
> **Extended:** 2026-08-28 (same session) with Workstreams D–I after a substrate audit — several tools partially exist; each workstream names what is already there.
> **Companion docs:** `docs/CHAT_IMAGE_INTERACTION_PLAN.md` (chat-side image interaction; its Phase 3 autorater is the precedent for the verification loop in Workstream A), `directives/font_consistency.md` (app-UI font rules — this plan is about *asset* typography, not UI fonts).

---

## 1. Purpose

Today the creative pipeline produces **approximations**. Three gaps force re-generation loops and generic-looking output:

1. **`add_character_reference` only guides generation.** It stores a reference data-URL (it is literally an alias of `set_entity_anchor` in `DirectorTools.ts`) and asks the model to "be similar." Nothing measures whether the output face is actually the founder's face. The 'Dii'-grade problem: output looks like a generic AI person.
2. **Typography is drawn, not typeset.** The generative model "paints" letterforms, so the 'Dii' wordmark needs many iterations and never has exact kerning or exact glyphs.
3. **Generated images are flattened rasters.** Any change — background color balance, subject lighting, moving an element — means a full re-generation.

This plan delivers three tools that close those gaps:

| Codename | Deliverable | Gap closed |
|---|---|---|
| `direct_likeness_fusion` (Workstream A) | Verified-headshot → generated-subject fusion **with a computed identity-similarity score and automatic retry loop** | "Is it actually me?" becomes measurable, not vibes |
| `custom_typography_engine` (Workstream B) | Upload .otf/.ttf → text rendered as **true vector glyph paths** (opentype.js kerning), composited as a layer — never drawn by the generative model | Wordmarks are pixel-exact on the first pass |
| `live_canvas_layer_editor` (Workstream C) | Generated image becomes a **layered, non-destructive document** (Fabric.js): per-layer color balance, lighting shifts, element moves, re-export without re-generation | "Adjust" stops meaning "regenerate" |
| `automated_brand_compliance_scanner` (Workstream D) | Every asset scored against the Brand Kit (palette ΔE, fonts, logo/safe-zone) with a structured violation report; gates finalize/export | Subjective eyeball review becomes a deterministic gate |
| `cinematic_motion_generator` (Workstream E) | Static still → calibrated 4-second camera moves (dolly/pan/tilt) rendered deterministically; generative micro-motion opt-in | Social video without a video team |
| `photorealistic_mockup_generator` (Workstream F) | Finished artwork composited onto vinyl/CD/cassette/merch renders via locked prompt templates on the merch catalog | Instant professional marketing collateral |
| `multi_platform_asset_exporter` (Workstream G) | One command → every platform dimension (Spotify 3000×3000, Stories, YouTube, X, Facebook) with subject-aware crops | Manual resizing eliminated |
| `asset_versioning_and_metadata_manager` (Workstream H) | Append-only version graph + provenance + usage-rights metadata per asset; non-destructive revert | Every asset traceable, attributable, revertible |
| `distribution_ready_render_pipeline` (Workstream I) | Profile-driven export bundles meeting DSP/print specs (dims, bleed, sRGB, size caps) behind the compliance gate, with manifest | Zero rejections at delivery |

Each workstream is independently shippable. **No workstream requires another.** Where they meet (text layers and fusion outputs land in the layer editor), the integration phases say so explicitly.

---

## 2. Why This Matters

Current flow:

```text
prompt + headshot reference → generative model → hope → manual eyeball check → re-roll N times → flatten → re-generate to fix background → repeat
```

Target flow:

```text
prompt + VERIFIED headshot → generate → EMBED + SCORE face identity → auto-retry until threshold → fused asset
prompt + UPLOADED FONT → vector text layer → composite once → exact wordmark
generated image → LAYERED DOC → adjust background grade / subject light / move element → re-export (no model call)
```

The first two turns model guesswork into verification and determinism. The third turns re-generation into document editing. This matches the repo's 3-layer architecture: deterministic execution (Layer 3) replaces probabilistic retries (Layer 2) wherever possible.

---

## 3. Decisions (Locked)

Locked by the founder 2026-08-28. Do not re-litigate without his sign-off.

| # | Decision | Reason |
|---|---|---|
| DEC-1 | Fusion output must be **measured**, not asserted: a numeric face-identity similarity score is computed for every fused output and stored on the history item | Founder: output must be "unequivocally you"; eyeballing failed |
| DEC-2 | Fusion source must be a **verified user likeness** (`LikenessService` selfie or brandKit `category === 'headshot'` asset), never an arbitrary gallery image | Real-user authenticity policy; no third-party face swaps |
| DEC-3 | Typography renders through **font file parsing (opentype.js) into vector paths**, not through any generative model | Founder: exact kerning / exact font rendering |
| DEC-4 | The layer editor is **non-destructive**: adjustment parameters are stored data; the raster is never permanently modified; export is a derived view | Founder: adjust without re-generating |
| DEC-5 | All tools are exposed both as **Studio UI panels** and as **agent tools** (CreativeAgent / BrandAgent) | Founder works through Conductor chat and Studio both |
| DEC-6 | The compliance scan is a **gate**, not a suggestion: a failing asset ships only via explicit override-with-reason, stored with the asset's record | Founder: "flag any output that deviates … before it ever reaches the user" |

### Assumptions (agent-derived — founder may override, do not silently change)

| # | Assumption | Why |
|---|---|---|
| A-1 | Identity embedding via `@vladmandic/human` (MIT; bundled local model weights, **no runtime CDN fetch** — CSP/offline/App Check). Fallback documented in A1.6 | One dep gives detection + landmarks + 128-d embedding |
| A-2 | Typography parsing via `opentype.js` (MIT). **.woff2 is NOT supported in v1** — opentype.js cannot parse it; tool returns a clear "convert to .ttf/.otf" error | Honest limit, surfaced in UI |
| A-3 | Layer editor on Fabric.js ^7.2.0 (already in `packages/renderer/package.json`; merch module is prior art). `CanvasDoc` JSON is the canonical project format; PSD export is a derived view (Phase C3, optional) | PSD writing adds a heavy dep for a format founder may not need day-one |
| A-4 | True pixel-level GAN face swap (insightface `inswapper_128`) is **Phase A2, desktop-only, default OFF** — its model weights carry a non-commercial research license; shipping it in a commercial product needs a licensing decision. Phase A1 (alignment + guided regeneration + verification loop) is the shipping path | Legal gate; see A2 phase notes |
| A-5 | New npm deps installed per CLAUDE.md §9 concurrency guardrail (isolated cache flag), after checking workspace layout | Repo protocol |
| A-6 | Motion default = deterministic Remotion camera-move path (E1); generative video (E2, existing `firstFrame` Veo path) is flag-gated opt-in for cost control | Deterministic moves are repeatable, brand-safe, and free; Veo calls cost tokens |
| A-7 | Exporter extends `CanvasBatchService.PLATFORM_DIMENSIONS` (single registry) rather than creating a parallel dimension list | Registry already exists; a second list would drift |
| A-8 | v1 exports are sRGB; CMYK/ICC press conversion is a documented print-vendor handoff step | Browsers cannot reliably bake ICC CMYK; honest limit recorded in Workstream I |

---

## 4. Ground Rules for the Executing Agent (READ FIRST — non-negotiable)

1. **Bootstrap:** `cat .agent/HANDOFF_STATE.md` → machine state check → route per CLAUDE.md *before* coding.
2. **Error Ledger before debugging:** `.agent/skills/error_memory/ERROR_LEDGER.md` + mem0 (`userId="indii-errors"`). Protocol violation otherwise.
3. **Branch:** work on `main` only. Read `.agent/workflows/branch-safety.md` before any git action. Push with explicit refspec `git push origin HEAD:main`. One coherent commit per phase.
4. **Before any push:** run `/plat` (`.claude/commands/plat.md`) and `npm run typecheck && npm run lint`.
5. **npm installs:** CLAUDE.md §9 — isolated cache: `npm install --cache ./.npm-cache-isolated-$$ <pkgs>`. Never `rm -rf node_modules` while other agents may be building. Check workspace layout first (`grep -n workspaces package.json`).
6. **No hardcoded infrastructure identifiers** in frontend source (CLAUDE.md §11). Model names come from `@/core/config/intelligence-models` (`APPROVED_MODELS` / `INTELLIGENCE_MODELS`) — never string literals like `"gemini-..."` in new code.
7. **Real-user authenticity:** `.agent/REAL_USER_AUTHENTICITY.md`. The similarity score must be *computed* from real embeddings of the real user's uploads. Never fabricate, seed, or hardcode scores. Never claim "verified likeness" without a score above threshold.
8. **No runtime model/CDN fetches from the browser bundle.** All ML weights vendored under `packages/renderer/public/models/` (create if absent). Verify licenses of every model weight file before vendoring; record license in a `LICENSES.md` next to the weights.
9. **Tests co-located** (`*.test.ts` next to source), Vitest + jsdom, mocks per `packages/renderer/src/test/setup.ts`. Mock-backed tests are structural proof only — they never count as real-path validation.
10. **Communication:** caveman-terse in chat (CLAUDE.md §0); code complete, no placeholders.
11. **Never declare victory** (CLAUDE.md §-1). State exact status + caveats when closing a phase.

---

## 5. Architecture Overview

```text
                    ┌──────────────────────────────────────────────┐
                    │            Creative Studio (module)          │
                    │  LikenessFusionPanel │ TypographyPanel │     │
                    │              CanvasEditor (tabs)             │
                    └───────┬───────────────┬───────────────┬──────┘
                            │               │               │
        ┌───────────────────┘               │               └───────────────────┐
        ▼                                   ▼                                   ▼
 services/identity/            services/typography/                  services/canvas/
   FacePipeline.ts                FontLibrary.ts                        CanvasDoc.ts
   LikenessFusionService.ts       TextVectorRenderer.ts                 CanvasDocumentService.ts
        │                                   │                                   │
        │            services/image/ (EXISTING — do not duplicate)              │
        └──────────► ImageGenerationService.generateImages() ◄──────────────────┘
                     EditingService (backend edit path)
                     LikenessService (verified selfies — fusion source of truth)
```

**Existing substrate (USE THESE — audit before writing anything new):**

| Asset | Path | Role in this plan |
|---|---|---|
| LikenessService | `packages/renderer/src/services/image/LikenessService.ts` | Verified selfie store (`users/{uid}/likeness/{imageId}` in Firestore+Storage, max 5, quality-scored). Fusion source of truth (DEC-2). Mirror its upload pattern for fonts (B). |
| ImageGenerationService | `packages/renderer/src/services/image/ImageGenerationService.ts` | Canonical backend-proxy generation. Already auto-injects brandKit `category === 'headshot'` reference images (see ~line 401). A1 builds on `generateImages()` — never call models directly. |
| EditingService | `packages/renderer/src/services/image/EditingService.ts` | Backend edit path w/ retry + error normalization. A1 candidate re-rolls reuse its retry/error patterns. |
| Store slice pattern | `packages/renderer/src/core/store/slices/creative/creativeControlsSlice.ts` | `characterReferences` (max 3), `whiskState`. New editor slice follows this file's exact conventions. |
| Fabric prior art | `packages/renderer/src/modules/merchandise/` (MerchDesigner, DesignCanvas, `types/fabric-extensions.ts`, `hooks/useAutoSave.ts`) + `packages/renderer/src/lib/canvasUtils.ts` | Fabric 7 canvas, export, autosave patterns to copy |
| Agent tool registration | `packages/renderer/src/services/agent/tools/{DirectorTools,CanvasTools,UniversalTools}.ts`, `definitions/CreativeAgent.ts`, `agents/capability_registry.json`, `agents/creative/prompt.md` | Every new tool registers in ALL of these (test file `CreativeAgent.test.ts` asserts authorizedTools membership — update it too) |
| Verification-loop precedent | `docs/CHAT_IMAGE_INTERACTION_PLAN.md` Phase 3 | Autorater pattern: generate → score → self-correct |
| CanvasBatchService | `packages/renderer/src/services/image/CanvasBatchService.ts` | Multi-platform batch export + `PLATFORM_DIMENSIONS` registry (tiktok/ig/yt/snap). Workstream G **extends** this — never create a parallel dimension list (A-7) |
| CanonicalCoverArtService | `packages/renderer/src/services/distribution/CanonicalCoverArtService.ts` | `content_hash` + `generation_provenance` pattern — precedent for Workstream H (versioning) and I (manifests) |
| VideoGenerationService | `packages/renderer/src/services/video/VideoGenerationService.ts` | Already accepts `firstFrame` (image-to-video) — substrate for Workstream E2 |
| Video renderers | `packages/renderer/src/services/video/{LocalVideoProjectRenderer,CloudVideoRenderService,RenderService,ParallelRenderOrchestrator}.ts` | Remotion-class render contracts — substrate for Workstream E1 |
| Merch module | `packages/renderer/src/modules/merchandise/` + `packages/renderer/src/services/merchandise/MerchandiseService.ts` | Product catalog (`merchandise_catalog`), Fabric design canvas, generation via ImageGeneration/WhiskService — substrate for Workstream F |
| ImageAnalysisService | `packages/renderer/src/services/image/ImageAnalysisService.ts` | Gemini vision object detection returning `Box2D` boxes — substrate for logo detection (D) and crop anchoring (G) |
| BrandAgent brand tool | `packages/renderer/src/services/agent/definitions/BrandAgent.ts` (`analyze_brand_consistency`) | Existing brand check — desktop-only vision or text-only prose. Workstream D **absorbs and replaces** it with the deterministic engine + structured report |
| Direct Distribution Engine V3 | `directives/direct_distribution_engine.md` | Audio-side hard gates, style-guide JSONs, `.itmsp` packaging — Workstream I is its visual analog |
| plpBatch | `packages/renderer/src/modules/creative/plpBatch.ts` | Slot/attempt batch orchestration pattern — reference for exporter bundles and fusion attempt loops |

**New dependencies (one install, Phase A1 start):**

```bash
# verify workspace layout FIRST, then from repo root:
npm install --cache ./.npm-cache-isolated-$$ opentype.js @vladmandic/human
# Phase C3 only (optional): ag-psd  |  subject-split: @imgly/background-removal (license-check first)
```

Model weights to vendor (license-check + record per Ground Rule 8): human's face detection/recognition models → `packages/renderer/public/models/human/`.

---

## 6. Workstream A — `direct_likeness_fusion`

**Goal:** take the verified headshot (e.g., IMG_4488 in My Likeness) and a generated subject image; produce a fused image whose face is *measured* as the founder's face — with automatic retry until it passes.

### Phase A1 — Verification loop (WEB, shipping path)

**Scope:** identity embedding + scoring + best-of-N guided regeneration. No GAN swap. Pure client orchestration over the existing backend generation/edit services.

**New files:**

- `packages/renderer/src/services/identity/FacePipeline.ts`

```ts
export interface DetectedFace { box: { x: number; y: number; width: number; height: number }; score: number; }
export interface FaceAnalysis { faces: DetectedFace[]; primaryEmbedding: number[] | null; }
export async function analyzeFace(dataUrl: string): Promise<FaceAnalysis>;   // detect + embed primary face
export function cosineSimilarity(a: number[], b: number[]): number;          // pure, unit-tested
export async function loadHuman(): Promise<HumanInstance>;                    // singleton, lazy, local models only
```

- `packages/renderer/src/services/identity/LikenessFusionService.ts`

```ts
export const IDENTITY_SIMILARITY_THRESHOLD = 0.55;   // tune with real pairs; see A1.5
export interface FusionRequest {
    targetDataUrl: string;        // generated subject image (from gallery/history)
    headshotId?: string;          // LikenessService id; omit = newest good-quality selfie
    maxAttempts?: number;         // default 3
    preservePromptNote?: string;  // optional founder steering
}
export interface FusionAttempt { dataUrl: string; similarity: number; }
export interface FusionResult { dataUrl: string; similarity: number; passedThreshold: boolean; attempts: FusionAttempt[]; }
export async function fuseLikeness(req: FusionRequest): Promise<FusionResult>;
```

**Pipeline (deterministic loop):**

1. Resolve headshot via `LikenessService.getAll()` (or brandKit headshot fallback). Reject with clear error if none exists — direct founder to My Likeness upload. **Never** accept arbitrary gallery images as source (DEC-2).
2. `analyzeFace(headshot)` → require exactly ≥1 face, record embedding. Reject unreadable headshots with specific errors.
3. Build edit request to `EditingService`/`ImageGenerationService` with `sourceImages: [headshot, target]` and the locked identity prompt suffix (constant `LIKENESS_IDENTITY_PROMPT_SUFFIX` in the service — e.g. exact facial structure, skin texture, distinctive features preserved from reference 1; reference 2 supplies pose/wardrobe/scene). Model choice from `APPROVED_MODELS` — never a literal.
4. `analyzeFace(result)` → `cosineSimilarity` vs headshot embedding. Record attempt.
5. If `similarity < IDENTITY_SIMILARITY_THRESHOLD` and attempts remain → re-roll (strengthen identity clause). Return best-of-N with `passedThreshold` flag; UI shows the score.
6. **Calibration task (A1.5, mandatory before claiming done):** compute similarity for 5 known-same pairs and 5 known-different pairs using the founder's real likeness uploads + generated images. Document chosen threshold + distribution in this file's Current State. Mock-based tests cannot set the threshold.

**Store/UI wiring:**

- `packages/renderer/src/modules/creative/components/LikenessFusionPanel.tsx` — panel with: headshot picker (from My Likeness), "Fuse onto selected image" action, per-attempt score readout, pass/fail badge.
- Gallery entry point: extend `packages/renderer/src/modules/creative/components/CreativeGallery.tsx` item menu with "Fuse Likeness…" (mirror the existing `addCharacterReference` button wiring at ~line 399).
- History item for each attempt gets `meta: 'likeness_fusion'` + `metaDetails: { similarity, headshotId, passedThreshold }` (mirror `set_entity_anchor`'s `meta: 'entity_anchor'` pattern in `DirectorTools.ts`).

**Agent tool:**

- `fuse_likeness` in `DirectorTools.ts` (wrapTool pattern): args `{ targetImageIndex: number; headshotId?: string; maxAttempts?: number }` → calls `fuseLikeness`, adds result to history, returns score in the tool message. Register in: `definitions/CreativeAgent.ts` (functions map + `authorizedTools`), `agents/capability_registry.json`, `agents/creative/prompt.md`, and update `CreativeAgent.test.ts` membership assertions.

**Acceptance criteria:**

- [ ] **A1.1** `FacePipeline` loads human from vendored local weights only; unit test asserts no network fetch attempt (jsdom fetch mock).
- [x] **A1.2** `cosineSimilarity` unit tests (identical=1, orthogonal=0, inverted=-1, dimension-mismatch throws).
- [x] **A1.3** `fuseLikeness` service tests with mocked pipeline: rejects no-headshot, rejects no-face headshot, retries below threshold, returns best-of-N, stores attempt list.
- [x] **A1.4** `fuse_likeness` tool test mirrors `DirectorTools.test.ts` §`add_character_reference` style; registry + prompt.md + authorizedTools test updated.
- [ ] **A1.5** Threshold calibrated on REAL pairs (Ground Rule 7); distribution + chosen value recorded in Section 19.
- [x] **A1.6** Fallback documented if `@vladmandic/human` is unusable (e.g., wasm constraint): `@mediapipe/tasks-vision` FaceLandmarker for geometry + declare honestly that v1 fallback scores geometry-fit, not identity — requires founder sign-off to ship in that degraded mode.
- [ ] **A1.7** Panel smoke: pick IMG_4488 from My Likeness → fuse onto a generated subject → score displayed → result in Gallery with meta.

**Estimated commits:** 3–4.

### Phase A2 — Pixel-accurate swap (DESKTOP, optional, DEFAULT OFF — legal gate)

**Scope:** true GAN swap via insightface (`buffalo_l` detect/embed + `inswapper_128`) in a Python sidecar, invoked from the Electron main process only.

- Sidecar script: `execution/identity/fuse_likeness_pixel.py` (align → swap → color-transfer → Poisson blend → return PNG + embedding similarity computed with the same ArcFace model used for the swap — score is model-consistent).
- Electron bridge: new IPC handler in `packages/main/src/main.ts` (or a `packages/main/src/identity/` module) spawning the sidecar; renderer calls it via the existing preload bridge pattern.
- Gated: runtime flag `VITE_ENABLE_PIXEL_SWAP` + desktop-build detect. **Web bundle must never include or invoke it.**
- **BLOCKED ON FOUNDER:** inswapper_128 weights are non-commercial-research licensed. Do not vendor or download them until William makes an explicit licensing decision (alternatives: licensed commercial swap model, or stay on A1). Record the decision here when made: ________.
- Weights download at first desktop run WITH explicit user consent dialog; never bundled in installers.

**Acceptance criteria:** defined when unblocked. Do not start A2 without the decision above.

---

## 7. Workstream B — `custom_typography_engine`

**Goal:** upload .otf/.ttf fonts; render text as exact vector glyph paths with the font's own kerning; composite as a layer over any image. The generative model never touches letterforms (DEC-3).

### Phase B1 — Font library + vector renderer (self-contained)

**New files:**

- `packages/renderer/src/services/typography/FontLibrary.ts`

```ts
export interface RegisteredFont { id: string; family: string; style: string; format: 'ttf' | 'otf' | 'woff'; storageRef?: string; addedAt: number; }
export async function registerFont(file: File): Promise<RegisteredFont>; // opentype.parse + FontFace API + persist (mirror LikenessService Storage/Firestore pattern: users/{uid}/brandKit/fonts/)
export async function listFonts(): Promise<RegisteredFont[]>;
export async function loadOpenTypeFont(id: string): Promise<opentype.Font>;
```

- `packages/renderer/src/services/typography/TextVectorRenderer.ts`

```ts
export interface TextRenderOptions { fontSize: number; letterSpacing?: number; kerning?: boolean /* default true */; align?: 'left'|'center'|'right'; x: number; y: number; }
export interface VectorText { svgPathD: string; width: number; height: number; baselineY: number; glyphCount: number; advanceWidth: number; }
export function renderTextPath(text: string, font: opentype.Font, opts: TextRenderOptions): VectorText;
export async function rasterizeVectorText(v: VectorText, cssColor: string, scale: number): Promise<string>; // dataURL, transparent bg
```

opentype.js specifics the implementing agent must honor:
- `font.getPath(text, x, y, fontSize, { kerning: true })` applies the font's `kern`/GPOS pair kerning. Per-pair values via `font.getKerningValue(a, b)`. `letterSpacing` is explicit tracking **added on top**, in font units → convert via `font.unitsPerEm`.
- **Multi-byte/complex scripts NOT supported in v1** (opentype.js has no shaping) — restrict UI to Latin input with a clear validation error otherwise. Honest limit.
- `.woff2` → reject with "convert to .ttf/.otf" message (A-2).

**Layer output (works standalone today, lands in CanvasDoc later):**

```ts
export interface TypographyLayer {
    id: string; kind: 'text'; fontId: string; text: string; fontSize: number;
    letterSpacing: number; kerning: boolean; fill: string; stroke?: { color: string; width: number };
    x: number; y: number; rotation: number; opacity: number; visible: boolean;
    vector: VectorText; // frozen at render — re-derive on text/font change
}
```

**Tests (determinism is the whole point — test it hard):**

- Fixture font: bundle one small OFL-licensed .ttf under `packages/renderer/src/services/typography/__fixtures__/` (record license in `LICENSES.md`).
- Golden test: `renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, kerning: true })` → snapshot `svgPathD` + `advanceWidth`. Changing `letterSpacing: 10` must increase `advanceWidth` by exactly `10 * 2` glyph gaps converted per unitsPerEm math (assert formula, not magic number).
- Kerning pair test: assert `getKerningValue('A','V')` flows into path offsets when the fixture font has a kern table; if the fixture lacks kerning, the test asserts kerning=true/false produce identical output (and note it).
- Persistence round-trip: registerFont → listFonts → loadOpenTypeFont returns working font (mocked Firebase per test setup).

**Acceptance criteria:**

- [x] **B1.1** FontLibrary upload/parse/register/persist tests green (jsdom + test-setup mocks).
- [x] **B1.2** Golden vector snapshot tests green and stable across runs.
- [x] **B1.3** .woff2 and non-Latin input rejected with specific, user-actionable errors.
- [x] **B1.4** `rasterizeVectorText` produces transparent-background PNG at requested scale (canvas-mocked per test setup, verified dimensionally).

**Estimated commits:** 2.

### Phase B2 — Studio panel + agent tool

**New/modified files:**

- `packages/renderer/src/modules/creative/components/TypographyPanel.tsx` — font upload, font list, text input, size/tracking/kerning controls, color, drag-place preview, "Add as layer / Export composite".
- Export composite (standalone path until C exists): draw base image + rasterized vector text at doc resolution → PNG download + history item (`meta: 'typography_layer'`).
- Agent tool `render_typography` in `DirectorTools.ts`: args `{ text, fontId?, fontSize, x, y, letterSpacing?, fill? }` (fontId omitted → brandKit default font; tool error lists available fontIds when unknown). Register everywhere per Section 5 row (registry, prompt.md, CreativeAgent, its test).
- `agents/creative/prompt.md` §tool list gains `render_typography` with the guidance: "For wordmarks/logos/any brand text ALWAYS prefer render_typography over asking the image model to draw letters."

**Acceptance criteria:**

- [x] **B2.1** Panel RTL tests: upload mock font → renders controls → produces layer/composite (mirror `CharacterLibrary.test.tsx` store-mocking style).
- [x] **B2.2** `render_typography` tool test + registration assertions.
- [ ] **B2.3** Real smoke: upload the founder's brand font, render the 'Dii' wordmark over a generated cover, compare against the font's own metrics in a vector app — record result in Section 19.

**Estimated commits:** 2.

---

## 8. Workstream C — `live_canvas_layer_editor`

**Goal:** every generated image can open as a layered, non-destructive document. Adjust background grade, shift subject lighting, move/swap elements; re-export instantly with zero model calls (DEC-4).

### Phase C1 — Document model + editor core

**New files:**

- `packages/renderer/src/services/canvas/CanvasDoc.ts`

```ts
export type CanvasBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
export interface AdjustmentStack {            // 0/neutral defaults; ALL fields required for serialization stability
    brightness: number;   // -1..1
    contrast: number;     // -1..1
    saturation: number;   // -1..1
    hue: number;          // -180..180 (deg)
    temperature: number;  // -1..1  (cool↔warm via BlendColor)
    exposure: number;     // -1..1
    blur: number;         // 0..1
    vignette: number;     // 0..1
}
export interface BaseLayer { id: string; name: string; visible: boolean; locked: boolean; opacity: number; blendMode: CanvasBlendMode; x: number; y: number; scaleX: number; scaleY: number; rotation: number; }
export interface RasterLayer extends BaseLayer { kind: 'raster'; src: string; adjustments: AdjustmentStack; subjectIsolated?: boolean; }
export interface TextLayer extends BaseLayer { kind: 'text'; typography: TypographyLayer; }   // from Workstream B — declared now, wired in C3
export type CanvasLayer = RasterLayer | TextLayer;
export interface CanvasDoc { id: string; projectId: string; width: number; height: number; background: string; layers: CanvasLayer[]; updatedAt: number; }
export const NEUTRAL_ADJUSTMENTS: AdjustmentStack;
export function createDocFromImage(src: string, projectId: string): CanvasDoc;  // single background layer
```

- `packages/renderer/src/services/canvas/CanvasDocumentService.ts` — load/save/list docs via `CreativeStorageService` (existing persistence path), autosave hook mirroring merch `useAutoSave.ts`.
- `packages/renderer/src/core/store/slices/creative/canvasEditorSlice.ts` — `currentDoc`, `selectedLayerId`, actions: `openDoc`, `addRasterLayer(src)`, `updateLayer(id, patch)`, `setAdjustments(layerId, patch)`, `reorderLayer(id, toIndex)`, `removeLayer(id)`, `closeDoc`. Register the slice in the root store exactly the way existing slices are registered in `packages/renderer/src/core/store/index.ts`.
- `packages/renderer/src/modules/creative/components/CanvasEditor/` — `CanvasEditor.tsx` (Fabric 7 static canvas, one `fabric.Image` per raster layer, filters from `adjustments`), `LayerList.tsx`, `AdjustPanel.tsx`, `ExportBar.tsx`.
- Entry point: "Open in Layer Editor" on gallery items (mirror the chat-plan's Phase 1 "Open in Studio" wiring pattern — proven UX).

**Non-destructive rules (DEC-4, enforce in review):**

- Adjustment params live ONLY in `CanvasDoc`. Fabric filters are rebuilt from params on every change (`fabric.filters.Brightness/Contrast/Saturation/HueRotation/BlendColor/Gamma/Blur` + a small Convolute-based vignette). The source raster element is cached and never mutated.
- Temperature maps to `BlendColor` warm/cool tint (not hue) to avoid skin-tone shifts.
- Export = render pipeline at `width×height × exportScale` → PNG/JPEG; PSD export is C3.

**Acceptance criteria:**

- [x] **C1.1** `createDocFromImage` + slice action unit tests (state shape, immutability, reorder bounds).
- [x] **C1.2** AdjustmentStack → Fabric filter mapping unit tests: each field maps to exactly one filter instance; neutral stack applies zero filters.
- [ ] **C1.3** Editor RTL: open image → layer list shows 1 layer → toggle visibility/lock → adjustments sliders dispatch `setAdjustments` (store mocked like `DirectGenerationTab.test.tsx`).
- [ ] **C1.4** Export unit test: doc with 2 layers + adjustments exports at 2× scale with expected canvas dimensions (canvas-mocked).
- [ ] **C1.5** Autosave round-trip: doc → storage → load → deep-equal (Firebase mocked per setup).

**Estimated commits:** 3–4.

### Phase C2 — Multi-layer workflow (elements, subject split, agent tools)

**Scope:**

- Add layer from any gallery item / upload; move/scale/rotate via Fabric interactions synced back to doc on `object:modified` (single source of truth = doc).
- "Split subject from background" layer op → produces two raster layers. Mechanism: `@imgly/background-removal` (wasm, on-device) — **license-check the model weights first** (Ground Rule 8); if blocked, mark feature flag-gated and record blocker in Section 19.
- Agent tools in `CanvasTools.ts` (file already exists — extend, don't duplicate):
    - `canvas_open_image({ imageIndex })` → doc from gallery item, returns docId.
    - `canvas_add_layer({ docId, imageIndex })`.
    - `canvas_set_adjustments({ docId, layerId, adjustments })` — partial patch merged over `NEUTRAL_ADJUSTMENTS`.
    - `canvas_export({ docId, format: 'png'|'jpeg', scale? })` → history item + URL in tool result.
- Register all four per Section 5 row. Update `CanvasTools.test.ts`.

**Acceptance criteria:**

- [ ] **C2.1** Each tool: unit test + registration assertions.
- [ ] **C2.2** `object:modified` sync test: Fabric transform → doc patch, no drift on repeated moves.
- [ ] **C2.3** Split-subject path: license decision recorded; either working op behind flag or documented blocker.
- [ ] **C2.4** Real smoke (founder path): open generated cover → cool the background 0.3 → warm subject 0.15 → move wordmark layer → export. Zero generation calls. Record in Section 19.

**Estimated commits:** 3.

### Phase C3 — PSD export + text-layer integration (optional)

- `ag-psd` writer: raster layers exported with adjustments **baked** (documented honestly — PSD gets flattened-layer rasters; the live params remain canonical in `CanvasDoc` JSON). Skip PSD adjustment-layer authoring.
- `TextLayer` wiring: `TypographyPanel` gains "Add to Layer Editor"; editor renders text via `rasterizeVectorText` + keeps `typography` block for re-derivation; SVG export path keeps text as true vectors.
- Acceptance criteria defined at phase start; requires C1+C2 and B1 done.

---

## 9. Workstream D — `automated_brand_compliance_scanner`

**Goal:** every generated asset is scored against the founder's Brand Kit (`BrandKit` in `packages/renderer/src/types/User.ts` — `colors: string[]`, `fonts`, `brandAssets`, `aestheticStyle`, `visualIdentity`, `digitalAura`) and gets a structured violation report BEFORE it can ship. Gate semantics per DEC-6.

**Existing substrate:** `ImageAnalysisService` (vision + `Box2D`), `BrandAgent.analyze_brand_consistency` (desktop-only or prose — to be absorbed), `BrandKit` type. No deterministic pixel engine exists today — that is the core build.

### Phase D1 — Deterministic pixel engine + report

**New files:**

- `packages/renderer/src/services/brand/ColorExtraction.ts`

```ts
export function extractDominantColors(dataUrl: string, maxColors?: number): Array<{ hex: string; coverage: number }>; // canvas downscale → median-cut quantization, deterministic
export function srgbToLab(hex: string): [number, number, number];
export function deltaE2000(lab1: [number,number,number], lab2: [number,number,number]): number; // pure
```

- `packages/renderer/src/services/brand/BrandComplianceService.ts`

```ts
export type ComplianceViolationType = 'color' | 'typography' | 'logo' | 'safe-zone' | 'aesthetic';
export interface ComplianceViolation {
    type: ComplianceViolationType;
    severity: 'error' | 'warning';
    detail: string;                                   // human + agent readable
    evidence?: { box?: Box2D; foundHex?: string; nearestBrandHex?: string; deltaE?: number };
}
export interface BrandComplianceReport {
    assetId: string; assetUrl: string;
    passed: boolean; score: number;                   // 0–100
    violations: ComplianceViolation[];
    engine: 'pixel' | 'vision' | 'hybrid';
    brandKitVersion: string; scannedAt: number;
}
export interface ComplianceConfig { colorToleranceDeltaE: number /* default 12 */; colorCoverageMinPct: number /* default 8 */; requireLogo: boolean; logoSafeZonePct: number /* default 5 */; passScore: number /* default 85 */; }
export async function scanAsset(assetUrl: string, brandKit: BrandKit, config?: Partial<ComplianceConfig>): Promise<BrandComplianceReport>;
```

**Check semantics (write tests to these exact rules):**

- **Color:** any quantized cluster with coverage ≥ `colorCoverageMinPct` whose nearest brand-kit hex ΔE2000 > `colorToleranceDeltaE` → `error` violation with found/nearest hex + ΔE evidence. Empty palette in brandKit → skip with `warning` "no palette defined".
- **Typography:** assets carrying an in-house `TypographyLayer` (Workstream B/C metadata) → exact `fontId` check against `brandKit.fonts`. Raster-only assets → engine marks typography `warning` "unverifiable from pixels" — NEVER guess fonts from pixels in v1.
- **Logo / safe-zone:** if `brandKit.brandAssets` contains a logo asset and `requireLogo`, run `ImageAnalysisService` detection; logo absent → `error`; logo center outside safe-zone margins (`logoSafeZonePct` of width/height) → `safe-zone` violation with `Box2D` evidence.

### Phase D2 — Vision engine, gate, agent tool

- Aesthetic check via structured-output Gemini call (follow the `Part`/`Schema` structured pattern already used in `ImageAnalysisService`) against `aestheticStyle`/`visualIdentity`/`digitalAura` → merged as `aesthetic` violations (`engine: 'hybrid'`). Structured JSON only — no prose parsing.
- **Gate (DEC-6):** gallery "Finalize" action, exporter (G1), and distribution pipeline (I1) call `scanAsset`; failing report blocks ship with a violations list + single escape hatch: **"Override with reason"** (reason text persisted into the report and the version record, Workstream H).
- Agent tool `scan_brand_compliance({ assetIndex })` — implement in `packages/renderer/src/services/agent/tools/BrandTools.ts` (file exists); it **replaces** the `analyze_brand_consistency` desktop/text path in `BrandAgent.ts` (keep the tool name working as an alias for one release, delegating to the new service, then remove). Register per Section 5 row (registry, prompt.md, agent definition + test).

**Acceptance criteria:**

- [ ] **D1.1** `deltaE2000` unit tests against published reference values (identical=0; red/green ≈ large; symmetric; Lab inputs validated).
- [ ] **D1.2** `extractDominantColors` deterministic: same input → identical output twice; known two-tone fixture → exactly the two clusters.
- [ ] **D1.3** `scanAsset` tests with mocked vision: off-palette dominant color → error violation w/ evidence; in-palette → pass; empty palette → warning path.
- [ ] **D1.4** Safe-zone math tests (logo box inside/outside margins).
- [ ] **D2.1** Gate test: failing report blocks finalize; override-with-reason persists reason.
- [ ] **D2.2** `scan_brand_compliance` tool test + registration assertions; `BrandAgent` alias delegation test.
- [ ] **D2.3** Real smoke: founder's actual brand kit scans one on-brand and one off-brand generated asset — scores/violations recorded in Section 19.

**Estimated commits:** 3.

---

## 10. Workstream E — `cinematic_motion_generator`

**Goal:** static high-res still → professional 4-second motion asset (slow dolly-in, gentle pan/tilt) for Stories/TikTok. Deterministic camera moves are the default (A-6); generative micro-motion is opt-in.

**Existing substrate:** Remotion in the stack; `LocalVideoProjectRenderer`, `CloudVideoRenderService`, `RenderService`, `ParallelRenderOrchestrator` in `packages/renderer/src/services/video/`; `VideoGenerationService` already accepts `firstFrame` (image-to-video) for E2.

### Phase E1 — Deterministic camera moves (default, free)

**New files:**

- `packages/renderer/src/services/video/MotionPresets.ts`

```ts
export type CameraMoveKind = 'dolly-in' | 'dolly-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'ken-burns';
export interface CameraMove { kind: CameraMoveKind; intensity: number; /* 0..1, default 0.35 */ durationSec: 4; }
export const MOTION_PRESETS: Record<string, CameraMove>;
export function moveTransform(move: CameraMove, progress: number /* 0..1 */, frameW: number, frameH: number): { scale: number; translateX: number; translateY: number; } // pure, cubic in-out easing, sub-pixel
```

- `packages/renderer/src/services/video/StillMotionRenderer.ts` — builds a single-layer Remotion composition (still image, per-frame transform from `moveTransform`, optional 30fps), renders through the existing `LocalVideoProjectRenderer` contract. Outputs: 1080×1920, 1920×1080, 1080×1350.
- **Overscan rule:** render from an overscanned source (base scale 1.08 + full move range) so frame edges never show at any progress value.

**UI/agent wiring:**

- Extend `packages/renderer/src/modules/creative/video/VideoWorkflow.tsx` with an "Animate still" flow: pick still → preset chips (4s each) → render → history item `meta: 'motion_clip'` (mirror existing `VideoWorkflow` store wiring).
- Agent tool `animate_still({ imageIndex, preset?, intensity? })` — locate the existing video tool module first (`grep -rn "generate_video\|animate" packages/renderer/src/services/agent/tools/`) and follow its registration pattern; register per Section 5 row.

### Phase E2 — Generative micro-motion (opt-in, costs tokens)

- Preset prompt scaffolds constant `CINEMATIC_MOVE_PROMPTS` in `MotionPresets.ts` (e.g., "slow dolly-in, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds") + `firstFrame` from the still via the existing `VideoGenerationService` path. Flag `VITE_ENABLE_GEN_MOTION` (default off) + visible cost notice before first call.

**Acceptance criteria:**

- [x] **E1.1** `moveTransform` pure tests: progress 0 and 1 anchors exact; monotonic; no translate exceeds the overscan envelope for any preset/intensity in 0..1.
- [x] **E1.2** Preset snapshot test (all seven presets serialize stable).
- [x] **E1.3** Renderer smoke: 24-frame test render completes via `LocalVideoProjectRenderer` (existing test infra in `services/video/__tests__/`).
- [x] **E1.4** `animate_still` tool test + registration assertions.
- [x] **E2.1** E2 path flag-gated off by default; prompt scaffold test asserts the no-scene-change clause is present.
- [ ] **E1.5** Real smoke: one founder still → dolly-in 4s 1080×1920 → plays correctly on an actual phone-sized viewport. Record in Section 19.

**Estimated commits:** 3.

---

## 11. Workstream F — `photorealistic_mockup_generator`

**Goal:** finished album cover → photorealistic vinyl/CD/cassette/merch/poster renders for store and social, on demand, no designer.

**Existing substrate:** the merch module already owns product visuals: `MerchandiseService` (`merchandise_catalog` admin templates, product CRUD, manufacture requests) uses `ImageGeneration` + `WhiskService`, and `DesignCanvas` composites artwork in Fabric. **F does NOT rebuild merch — it codifies mockup generation with locked templates and exposes it as a one-command tool.**

### Phase F1 — Mockup service + agent tool

**New file:** `packages/renderer/src/services/mockup/MockupService.ts`

```ts
export type MockupKind = 'vinyl-12' | 'cd-jewel' | 'cassette' | 'tee' | 'hoodie' | 'poster' | 'story-card';
export interface MockupRequest { artworkUrl: string; kind: MockupKind; colorway?: string; scene?: 'studio' | 'lifestyle' | 'flat'; aspectRatio?: string; }
export async function generateMockup(req: MockupRequest): Promise<{ url: string; kind: MockupKind; promptUsed: string }>;
export const MOCKUP_PROMPTS: Record<MockupKind, string>; // locked templates, see rules
```

**Template rules (enforced by test):**

- Every template contains the artwork-fidelity clause ("the provided artwork is reproduced EXACTLY as given — same colors, lettering, and proportions; do not redraw, reinterpret, or restyle it") plus kind-specific staging (vinyl: square sleeve + disc peeking; tee: 4:5 flat-lay or on-model per `scene`; poster: `aspectRatio` honored).
- Artwork is passed as `sourceImages` reference via `ImageGeneration` (never re-described in prose only).
- Model choice via `APPROVED_MODELS` constants — never string literals (Ground Rule 6).

**Agent tool:** `generate_mockup({ artworkIndex, kind, scene?, aspectRatio? })` in `DirectorTools.ts` — before adding, grep `services/agent/tools/` for an existing merch mockup tool and extend it instead if found. Result becomes a history item `meta: 'mockup'` + version record (H1 hook). Register per Section 5 row.

**UI:** gallery item menu gains "Make mockup…" → kind picker (mirror the existing `addCharacterReference` menu wiring in `CreativeGallery.tsx`).

**Acceptance criteria:**

- [x] **F1.1** Template tests: all seven kinds contain the fidelity clause; aspect map correct per kind.
- [x] **F1.2** Service test (generation mocked): correct sourceImages + template assembly; error when artwork missing.
- [x] **F1.3** `generate_mockup` tool test + registration assertions.
- [ ] **F1.4** Real smoke: founder's current cover → vinyl + tee mockups; artwork fidelity eyeball pass + optional compliance scan (D) pass. Record in Section 19.

**Estimated commits:** 2.

---

## 12. Workstream G — `multi_platform_asset_exporter`

**Goal:** one command: master artwork → every required platform asset. Founder's required matrix: Spotify **3000×3000**, Stories **1080×1920**, YouTube **1920×1080**, plus X/Twitter and Facebook crops.

**Existing substrate:** `CanvasBatchService` + `PLATFORM_DIMENSIONS` (tiktok/ig/yt/snap) already handles rescale/position/watermark. **G extends that registry (A-7) — never a second list.**

### Phase G1 — Preset matrix, smart crop, bundle export

**Modifications:**

- `CanvasBatchService.ts`: extend `PLATFORM_DIMENSIONS` with `spotify_cover 3000×3000`, `ig_story 1080×1920`, `yt_banner 2560×1440` (safe-area aware), `x_post 1600×900`, `x_profile 400×400`, `facebook_og 1200×630`, `tiktok_cover 1080×1920`. Keep existing rows untouched.

**New files:**

- `packages/renderer/src/services/export/SmartCrop.ts`

```ts
export interface CropAnchor { box: Box2D; kind: 'face' | 'logo' | 'manual'; }
export function computeCrop(srcW: number, srcH: number, dstW: number, dstH: number, anchors?: CropAnchor[]): { x: number; y: number; scale: number } // pure; face-anchored via FacePipeline (A1) when available, center-weighted fallback
```

- `packages/renderer/src/services/export/AssetExporter.ts`

```ts
export interface ExportPreset { dimensionId: string; fit: 'cover' | 'contain-blur-pad'; } // blur-pad = subject-fit + blurred self-fill for extreme aspect changes
export interface ExportBundleRequest { masterUrl: string; presets: ExportPreset[]; quality?: number; }
export interface ExportResult { platformId: string; url: string; width: number; height: number; bytes: number; }
export async function exportMasterAsset(req: ExportBundleRequest): Promise<ExportResult[]>; // headless offscreen canvas — NO Fabric import in this service
export async function downloadAsZip(results: ExportResult[], name: string): Promise<void>; // check for an existing zip dep (jszip/fflate) before adding one
```

**Fit rules:** `contain-blur-pad` is DEFAULT for aspect changes > 1.6× (square master → 9:16) so artwork is never destroyed by cropping; `cover` + `computeCrop` (face-anchored when a face exists) otherwise.

**Agent tool:** `export_platform_assets({ imageIndex, platforms? })` (default = full core matrix) → batch results as history items + zip. Register per Section 5 row. Optional G2 cross-link: Spotify Canvas = 9:16 mp4 via Workstream E1 dolly preset.

**Acceptance criteria:**

- [x] **G1.1** `computeCrop` table tests: square→9:16 face-anchored keeps face centered w/ margin; extreme aspect without anchors → center crop; identity crop for same aspect.
- [x] **G1.2** Registry test: founder's four required platforms exist with exact pixels (3000×3000, 1080×1920, 1920×1080, X/FB rows).
- [x] **G1.3** Exporter tests per fit mode at 2× scale (canvas-mocked): output dimensions exact; blur-pad composites blurred fill.
- [x] **G1.4** Lint guard: `AssetExporter.ts` imports no `fabric` (enforce with a test or eslint rule).
- [x] **G1.5** `export_platform_assets` tool test + registration.
- [ ] **G1.6** Real smoke: one 3000×3000 master → full matrix + zip opens cleanly. Record in Section 19.

**Estimated commits:** 2–3.

---

## 13. Workstream H — `asset_versioning_and_metadata_manager`

**Goal:** every asset has an append-only version history with provenance and usage-rights metadata; revert is always possible, nothing is ever destroyed.

**Existing substrate:** `HistoryItem { id, url, prompt, timestamp, projectId, meta }` (flat, no graph); `CanonicalCoverArtService` already models `content_hash` + `generation_provenance` — copy that shape. A1/C2/B2/G/F outputs already carry `meta` markers to hook into.

### Phase H1 — Version graph

**New file:** `packages/renderer/src/services/assets/AssetVersionService.ts`

```ts
export type VersionSource = 'generation' | 'edit' | 'fusion' | 'canvas-export' | 'typography' | 'mockup' | 'export-bundle' | 'upload';
export interface AssetVersion {
    versionId: string; assetId: string; parentVersionId: string | null;
    url: string; createdAt: number; source: VersionSource;
    provenance?: { provider?: string; model?: string; prompt?: string; note?: string }; // CanonicalCoverArtService shape
    compliance?: { passed: boolean; score: number };   // last scan from Workstream D
    tags: string[];
}
export async function recordVersion(input: Omit<AssetVersion, 'versionId' | 'createdAt'>): Promise<AssetVersion>; // append-only
export async function getVersionTree(assetId: string): Promise<AssetVersion[]>;
export async function promoteVersion(assetId: string, versionId: string): Promise<AssetVersion>; // revert = NEW head node copying the old version; never deletes
```

Persistence: Firestore `users/{uid}/assetVersions/{assetId}` — mirror `LikenessService` collection patterns exactly.

**Producer hooks (one line each, list them in the PR):** fusion attempts (A1), canvas exports (C1/C2), typography composites (B2), mockups (F1), exporter bundles (G1) each call `recordVersion` on success.

### Phase H2 — Rights metadata

```ts
export interface AssetRights { releaseId?: string; usageRights: 'ai-generated' | 'ai-assisted' | 'owned-licensed' | 'licensed-third-party'; licenseNotes?: string; disclosureRequired: boolean; }
export async function setRights(assetId: string, rights: AssetRights): Promise<void>;
```

- UI: rights editor on gallery item via the standardized awaited-dialog pattern (`react-call` per CLAUDE.md — never `window.prompt`).
- Export embedding v1: sidecar `manifest.json` written by G/I (in-browser EXIF/IPTC pixel embedding is NOT reliable — honest limit; true IPTC embed is a future optional lib addition).

**Acceptance criteria:**

- [x] **H1.1** record/tree/promote unit tests: append-only (no mutation), promote creates a new head node, orphan parent allowed.
- [x] **H1.2** At least two producer hooks (fusion + exporter) covered by tests calling `recordVersion`.
- [x] **H2.1** Rights validation tests (invalid `usageRights` rejected; `licensed-third-party` requires `licenseNotes`).
- [x] **H2.2** Rights editor RTL test using the dialog pattern.
- [ ] **H1.3** Real smoke: fuse → adjust in canvas → export; version tree shows all three with revert working. Record in Section 19.

**Estimated commits:** 2–3.

---

## 14. Workstream I — `distribution_ready_render_pipeline`

**Goal:** one command: master asset → delivery-ready bundle per DSP/print-house profile (dimensions, format, color space, bleed, size caps), gated by compliance (D) and rights (H), with a verifiable manifest. Zero rejections.

**Existing substrate:** Direct Distribution Engine V3 (`directives/direct_distribution_engine.md`) already runs audio-side hard gates, style-guide JSONs, `.itmsp` packaging — I is the visual analog and must slot beside it, not parallel to it.

### Phase I1 — Profile registry + pipeline

**New files:**

- `packages/renderer/src/services/distribution/RenderProfiles.ts`

```ts
export interface VisualRenderProfile {
    id: string;                    // 'spotify-cover' | 'apple-itunes-cover' | 'print-12in-sleeve-300dpi' | ...
    pixels: { width: number; height: number };
    format: 'jpeg' | 'png';
    colorSpace: 'sRGB';            // CMYK = vendor handoff, see limits
    dpi?: number; bleedMm?: number; maxBytes?: number; jpegQuality?: number; squareOnly?: boolean;
    notes: string[];
}
export const RENDER_PROFILES: Record<string, VisualRenderProfile>;
```

- `packages/renderer/src/services/distribution/DistributionRenderPipeline.ts`

```ts
export interface BundleRequest { masterUrl: string; profileIds: string[]; }
export interface BundleResult { profileId: string; url: string; sha256: string; bytes: number; }
export async function renderDistributionBundle(req: BundleRequest): Promise<{ results: BundleResult[]; manifest: object }>;
```

**Pipeline rules (each enforced by a test):**

- **Upsample policy:** master must be ≥ 97% of profile pixels; never upscale beyond 1.15× — reject with actionable error naming the profile and required master size ("master too small for print-12in-sleeve-300dpi: needs 3728×3728 @ 300dpi + bleed").
- **Bleed:** `bleedMm` → px via `dpi` math; bleed extension = edge-stretch of the outer 2% (documented, deterministic).
- **Gates:** compliance scan (D) pass-or-override and rights record (H2) present before any render; blocked results carry the blocking report reference.
- **Manifest:** per-file `sha256` (reuse the hash approach in `CanonicalCoverArtService`), profile snapshot, provenance — same spirit as the engine's binary-verification step.

**Honest limits (A-8, put in UI copy):** browsers cannot bake ICC CMYK rasters. v1 delivers sRGB masters at exact pixels + bleed + a per-profile spec sheet for the print vendor. DSP cover specs (3000×3000 sRGB JPEG/PNG under 50 MB — note `MAX_COVER_BYTES` already exists in `CanonicalCoverArtService`) are fully in scope.

**Agent tool:** `render_distribution_bundle({ masterIndex, profileIds? })`; register per Section 5 row.

**Acceptance criteria:**

- [x] **I1.1** Profile table test: every profile passes its own validator (pixels > 0, format/colorSpace valid, bleed requires dpi).
- [x] **I1.2** Upsample rejection tests (oversized ok, 1.15× boundary, undersized rejected with exact message).
- [x] **I1.3** Bleed math tests (mm→px at 300dpi; edge-stretch deterministic).
- [x] **I1.4** Gate tests: bundle blocked on failing compliance and on missing rights record.
- [x] **I1.5** Manifest shape test (sha256 present, profile snapshot matches registry).
- [ ] **I1.6** Real smoke: founder's release master → DSP bundle accepted by Spotify/Apple artwork validators or manually verified against published specs. Record in Section 19.

**Estimated commits:** 3.

---

## 15. Sequencing & Handoff States

Recommended order (each step shippable alone; a new agent can start at any boundary):

```text
1. A1  (fusion verification loop)        ← founder's #1 pain; zero deps on B/C
2. D1  (compliance pixel engine)         ← the gate everything downstream plugs into
3. G1  (platform exporter)               ← fast deterministic win on CanvasBatchService
4. F1  (mockup service + tool)           ← merch substrate already exists
5. E1  (deterministic motion presets)    ← Remotion substrate exists
6. B1  (font library + vector renderer)  ← self-contained; determinism tests
7. C1  (doc model + editor core)         ← substrate for integration
8. D2  (vision engine + gate wiring)     ← gates G/I finalize paths
9. B2  (typography panel + agent tool)
10. C2 (multi-layer + agent tools)
11. H1  (version graph + producer hooks) ← after producers exist to hook
12. I1  (distribution render profiles)   ← consumes D gate + H rights + G exports
13. A2 / C3 / E2 / H2                    ← gated or optional (A2: legal decision; E2: cost flag; H2: rights UI)
```

Handoff state after each step is recorded in **Section 19**. Update it before ending any session (same protocol as `docs/CHAT_IMAGE_INTERACTION_PLAN.md`).

---

## 16. Out of Scope (do NOT build without founder sign-off)

- Video-frame likeness fusion (video pipeline has its own consistency machinery).
- Cloud/GPU GAN swapping as a backend service (cost + licensing; A2 is desktop-only if it happens at all).
- Full PSD *adjustment-layer* authoring, smart objects, layer masks painting UI.
- Complex-script typography (Arabic/Devanagari shaping) — needs harfbuzz-class engine, separate plan.
- Replacing the existing Reference Mixer / `characterReferences` flow — fusion is additive.
- Multi-user collaborative canvas editing.
- In-browser CMYK/ICC press rasterization (A-8 — print-vendor handoff in v1).
- Generative video beyond the calibrated 4-second presets (E2 is opt-in micro-motion only).
- Physical manufacture/purchase flows — the merch module already owns manufacture requests; F is visual-only.
- Trademark/IP legal clearance automation — D flags brand deviations; it does not clear rights.
- Real-time compliance scanning during streaming generation — scan on finalize/export only.
- Pixel-embedded EXIF/IPTC metadata writes — H2 ships sidecar manifests in v1.

---

## 17. Risks & Honest Limits (carry these into UI copy and review)

| Risk | Mitigation |
|---|---|
| Embedding score ≠ perceptual identity in edge cases (lighting/hat/profile) | Threshold from real-pair calibration (A1.5); UI shows score, never claims "perfect match"; attempts list kept |
| Browser wasm perf for face pipeline on low-end machines | Lazy singleton load; run only on user action; graceful error path |
| opentype.js no shaping / no woff2 (A-2) | Explicit input validation + honest errors |
| inswapper licensing (A2) | Default OFF; founder decision gate |
| Fabric 7 filter quirks vs documented Fabric 6 in CLAUDE.md | Code against installed `^7.2.0`; note the doc drift; do not downgrade |
| Third-party face-swap misuse | DEC-2 source gating (verified likeness only); consent copy in panel |

---

## 18. Glossary

- **Identity embedding** — fixed-length vector describing a face; same-person pairs have high cosine similarity.
- **Vector text layer** — glyph outlines as SVG path data from the actual font file; resolution-independent, model-independent.
- **`CanvasDoc`** — JSON layered document (this plan's "PSD equivalent"); canonical, non-destructive; PSD/PNG are derived exports.
- **Fusion attempt** — one guided regeneration + its measured similarity; best-of-N wins.
- **Verified likeness** — image from `LikenessService` (or brandKit `category === 'headshot'`), uploaded by the authenticated user.
- **ΔE (CIEDE2000)** — perceptual color difference; 0 = identical, ≈2.3 = just-noticeable; scanner default tolerance 12.
- **Safe zone** — margin within which the logo must sit to survive platform UI cropping.
- **Render profile** — machine-readable delivery spec per platform/print house (pixels, format, color space, bleed, size cap).
- **contain-blur-pad** — fit mode that never crops the master: subject-fit centered over a blurred self-fill (used for extreme aspect changes).
- **Version graph / promote** — append-only asset history; "revert" promotes an old version to a NEW head node; nothing is deleted.
- **Provenance** — where an asset came from: provider, model, prompt, source (`CanonicalCoverArtService` already models this shape).

---

## 19. Current State

**Not started. No phase has an owner.**

**Substrate audit (2026-08-28, this session):** confirmed existing — `CanvasBatchService` + `PLATFORM_DIMENSIONS`, `VideoGenerationService` `firstFrame` path, merch catalog/canvas, `ImageAnalysisService` (vision + Box2D), `BrandAgent.analyze_brand_consistency` (desktop/text, to be absorbed by D), `CanonicalCoverArtService` provenance/hash, Remotion renderers. See each workstream's "Existing substrate" block before writing anything new.

- Phase A1: NOTE — A1.6 RESOLVED (founder signed off degraded geometry mode, 2026-08-29): FacePipeline now runs @mediapipe FaceLandmarker geometry (embeddingMode: 'geometry'), scale-invariant geometryFitSimilarity, loop supports geometry scoring. A1.2/A1.3/A1.4/A1.6 shipped (18 tests). A1.1 (@vladmandic/human identity backend, not installed) + A1.5 (real-pair threshold calibration — founder likeness uploads + generated images) + A1.7 (panel smoke) remain BLOCKED on install/founder. FACE_LANDMARKER_MODEL_PATH must be wired to a bundled face_landmarker.task at runtime; surfaces a specific error until then. Honest: geometry mode scores geometry-fit, NOT identity. (cosineSimilarity), A1.3 (mocked loop: reject no-headshot/no-face, retry below threshold, best-of-N), A1.4 (fuse_likeness tool + registration on CreativeAgent/Director + registry + prompt + tests) SHIPPED. A1.1 (real @vladmandic/human backend, not installed) + A1.5 (real-pair threshold calibration — founder data/data URIs required) + A1.6 (degraded-mode founder sign-off) + A1.7 (panel smoke) remain BLOCKED on dependency install + founder. fuse_likeness surfaces a specific "not configured" error until A1.1/A1.6 resolve (no silent degraded scoring).
- Phase B1 (font library + vector renderer): ☑ B1.1–B1.4 shipped. FontLibrary (opentype.js parse/persist via Firebase, .woff2 + size guard), TextVectorRenderer (deterministic renderTextPath + rasterizeVectorText + Latin-only v1 guard); fixture font constructed at runtime via opentype.js Font.toArrayBuffer() — deterministic tests without vendoring a licensed binary. 12 tests, tsc + lint clean. B2 (panel + render_typography tool) + B2.3 real smoke pending.
- Phase C1: ☑ C1.1+C1.2 shipped (CanvasDoc deterministic model: non-destructive Adjustments, NEUTRAL_ADJUSTMENTS, createDocFromImage, adjustments→Fabric filter mapping incl. temperature→BlendColor; standalone canvasEditorSlice with reorder/remove/adjust tests; slice registered in root store). C1.3 (Fabric Editor RTL UI components) + CreativeStorageService persistence remain.
- Phase D1 (compliance pixel engine): ☑ **DONE** — commit `b640f8a26`, CI green (run 33253189268, incl. production deploy). 48/48 brand-dir tests incl. all 12 Sharma ΔE2000 reference vectors. Canvas-wrapper behavioral proof still pending D2.3 smoke.
- Phase D2 (vision engine + gate): ☑ **core DONE** (second commit, this session) — `AestheticVisionEngine` (structured-output Gemini, hybrid engine merge, degrade-to-warning), `decideDelivery` DEC-6 gate, `scan_brand_compliance` agent tool in `BrandTools` + `BrandAgent` (authorized + declared + registry + prompt.md), `analyze_brand_consistency` asset path absorbed into the deterministic engine. 84/84 affected tests. **Open remainder:** D2.1's live finalize-button wiring + override-reason persistence land with H1 (no delivery-action surface exists yet — the gate logic and its tests ship now); D2.3 real founder-kit smoke still pending.
- Phase E1 (deterministic motion): ☑ E1.1–E1.4 + E2.1 shipped (MotionPresets pure moveTransform + overscan envelope, StillMotionRenderer over the render contract, animate_still tool, flag-gated E2 scaffold). E1.5 real smoke pending founder. VideoWorkflow "Animate still" UI wiring deferred (no acceptance checkbox; tool path + registration done).
- Phase E2 (generative micro-motion): ☐ flag-gated, not started
- Phase F1 (mockup service + tool): ☑ F1.1–F1.3 shipped (MockupService fidelity-locked templates + artwork-based mockup_merchandise extension + H1 mockup version hook; structural evidence). F1.4 real smoke pending founder.
- Phase G1 (platform exporter): ☑ G1.1–G1.5 shipped (structural evidence: 38 tests across 5 files, strict tsc + lint clean). G1.6 real smoke pending founder/browser.
- Phase H1 (version graph): ☑ H1.1+H1.2 shipped (AssetVersionService append-only graph + exporter/canvas producer hooks; structural evidence). H1.3 real smoke pending founder.
- Phase H2 (rights metadata): ☑ H2.1+H2.2 shipped (AssetRightsService set/get + validateRights incl. licensed-third-party requires licenseNotes; RightsEditorDialog via react-call awaited-dialog pattern). Sidecar manifest is written by I1; in-browser IPTC embedding deferred (A-8).
- Phase I1 (distribution render profiles): ☑ I1.1–I1.5 shipped (RenderProfiles registry + validateProfile, DistributionRenderPipeline upsample policy/bleed math/gates/manifest sha256). render_distribution_bundle agent tool + I1.6 real smoke pending.
- Phase B2: ☑ B2.1+B2.2 shipped (render_typography tool + TypographyPanel + full CreativeAgent/registry/prompt registration + RTL/tool tests). B2.3 real smoke pending founder.
- Phase C2: ☐ not started
- Phase A2: ☐ blocked on founder licensing decision (inswapper_128 non-commercial license)
- Phase C3: ☐ optional, not started

**Calibration record (fill at A1.5):** threshold = ____, same-pair distribution = ____, different-pair distribution = ____.

**Compliance thresholds (fill at D2.3):** colorToleranceDeltaE = ____, passScore = ____, founder-kit smoke results = ____.

**Real smoke results (fill at A1.7 / B2.3 / C2.4 / D2.3 / E1.5 / F1.4 / G1.6 / H1.3 / I1.6):** ____.
