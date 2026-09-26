# PRD — Image Upscaling & Print-Resolution Pipeline

**Date:** 2026-09-26
**Status:** Active — sliced into issues #320–#328 (Workstream 0 = #320; planner = #321; export = #322; local engine = #323; hosted = #324; tile-refine = #325; merch = #326; batch = #327; E2E = #328). Related: #319 (3000×3000 downgrade in the wild — fixed by #320).
**Workstreams:** 0 (resolution ceiling audit) + Local SR + Hosted SR + Tile-Refine + Print-Ready Export
**Related conversation:** Google API generation ceiling vs. print requirements; decision to build all three upscaler paths into this build.

---

## Problem Statement

Artists on indii generate cover art, merch graphics, and promo visuals with the platform's image models, then discover the artwork is too small for its destination. A generated image tops out around 4096px on the long edge — fine for a vinyl sleeve or a social post, but a poster, banner, or large DTF transfer needs 5400×7200 or more. Today there is no path from "the image the model gave me" to "the file my printer asks for": no upscale step, no print-size awareness, and no DPI-correct export. Artists either ship soft, blurry prints or leave to do it manually in other tools.

Separately, some routes through the platform cap output below what the models themselves support (agent-driven generation declares 2048×2048; the Flash tier's declared resolution disagrees between the renderer and server registries), so even the existing ceiling is not always available to the artist.

## Solution

Generation stays exactly where it is (Google's models, current quality). Behind it, indii adds a print-resolution pipeline:

1. **Every indii-side artificial ceiling is found and removed or justified** — the models' real capability is always available to every route that can carry it.
2. **A print-size planner** turns "I want an 18×24 poster" into concrete pixel math and tells the artist, before any work, whether the source is sufficient and what it will take.
3. **One upscale command with three engines behind it** — free on-device super-resolution in the desktop app, a hosted engine for web users on weak hardware (plan-gated, cost-controlled), and a premium tile-refine engine that re-invents fine detail for flagship poster work. The artist picks a print target; indii picks the engine.
4. **Print-ready export** — files leave the platform with correct DPI metadata, physical dimensions, and a pre-flight verdict, so what arrives at the printer is exactly what was promised.

The artist experience: pick the destination (vinyl, poster, tee, Spotify cover), see honest numbers, click upscale, export a file the printer accepts on the first try.

## User Stories

1. As an artist, I want to generate cover art and have it meet the 3000×3000 distributor minimum without workarounds, so that my release is accepted on the first submission.
2. As an artist, I want to upscale my artwork 2× or 4× on my own machine at no per-image cost, so that print preparation doesn't add to my monthly bill.
3. As an artist using indii in the browser on a laptop without a GPU, I want a hosted upscale option, so that I get the same print-ready output as desktop users.
4. As a paying Pro artist, I want access to a premium detail-refining upscale for my poster campaign, so that large-format prints hold up at viewing distance.
5. As an artist, I want to pick a print destination (vinyl sleeve, poster, tee transfer, social) instead of pixel dimensions, so that I don't need to know what 300 DPI means.
6. As an artist, I want the platform to tell me before upscaling whether my image can actually reach the target size with acceptable quality, so that I don't waste money on a print that will look soft.
7. As an artist, I want to see the physical print size my file supports (e.g., "13.6 × 13.6 in at 300 DPI"), so that I can sanity-check before ordering merch.
8. As an artist, I want progress and a cancel button during a long upscale, so that I'm never staring at a frozen spinner.
9. As an artist, I want my original image left untouched and the upscale saved as a new asset, so that I never lose my generation.
10. As an offline artist, I want the desktop upscaler to work without an internet connection, so that print prep doesn't require connectivity.
11. As an artist on an older machine, I want a clear message if my hardware can't run the local engine and a one-click switch to the hosted engine, so that I'm never blocked.
12. As an artist upselling merch, I want to upscale directly from the merchandise workflow, so that I don't have to export, leave, upscale elsewhere, and re-import.
13. As an artist creating mockups, I want the mockup generator to use upscaled source art when the target is large, so that mockups don't look blurry.
14. As a Free-tier artist, I want local upscaling free of charge, so that print readiness isn't paywalled at the entry tier.
15. As a Free-tier artist, I want hosted and premium engines clearly marked as plan features, so that I understand what upgrading buys me.
16. As a Pro artist, I want my hosted upscale usage counted against my existing budget guardrails, so that costs never surprise me.
17. As an artist, I want batch upscaling of a derivative pack (cover, stories, banners) in one action, so that release prep takes minutes, not hours.
18. As an artist, I want the upscaled file to include correct DPI metadata, so that my print shop accepts it without a support ticket.
19. As an artist, I want a warning when my target print size exceeds what any engine can credibly deliver, so that I choose a realistic format instead of a bad print.
20. As an artist, I want failed upscapes to leave a clear error and a retry that picks a different engine, so that one bad run doesn't dead-end me.
21. As an artist using the agent workforce, I want agent-driven image requests to stop being capped below model capability, so that agent-produced art is print-eligible too.
22. As an artist, I want consistent results when I re-run an upscale on the same image, so that my merch line stays visually identical across products.
23. As an artist, I want to export my print file with exact inch dimensions embedded, so that what I order is what I get.
24. As a platform operator, I want every paid upscale to pass the existing cost-control reservation path, so that spend stays bounded and attributable.

## Implementation Decisions

### Workstream 0 — Resolution ceiling audit and alignment

- Audit every indii-side resolution declaration on the generation path: the agent instrument capability, the per-tier `maxResolution` declarations, and the renderer-side per-model `imageSize` defaults.
- Reconcile the Flash-tier discrepancy: the renderer model config declares Flash max 1K while the server capability registry declares Nano Banana 2 at 4K. Establish the server capability registry as the single source of truth and fix the renderer declaration (and its stale comment).
- Decide the fate of per-tier resolution declarations: either enforce them deliberately at the gateway (they are currently display-only — nothing reads them in the generation path) or remove them. No silent display-only limits.
- Raise the agent instrument image-generation capability from its declared 2048×2048 to full model capability.
- This workstream is config and declaration cleanup only — no new features — and can ship independently and immediately.

### Workstream 1 — PrintSpec planner (deep module, pure)

- A single pure module owns all print math: given source pixel dimensions and a print target (media preset or explicit size + DPI), it returns required pixels, the necessary upscale factor, a sufficiency verdict, per-engine recommendations, and the DPI/physical metadata values for export.
- Media presets ship as data: vinyl sleeve, cassette J-card, poster sizes, standard DTF/transfer sizes, distributor cover art, social formats.
- No DOM, no canvas, no I/O — the same shape of isolation as the existing pure crop-math module used in multi-platform export. All thresholds (e.g., minimum credible DPI per media) live here, so they are testable and tunable in one place.

### Workstream 2 — UpscalerService (renderer facade)

- One entry point — upscale(image, printPlan, options) → result — hiding which engine ran. Callers (creative export, merchandise, mockups, workflow engine, agent instruments) never branch on engine choice.
- Routing logic: desktop app with capable hardware → local engine; web or incapable hardware → hosted engine; premium quality requested and entitled → tile-refine (which itself builds on a base upscale).
- Paid engines pass through the existing cost-control reservation path before any provider call; free local engine does not reserve.
- Emits progress events and supports cancellation; failures surface an engine-switch retry rather than a dead end.
- Output is always a new asset linked to the source (source immutability rule), with the plan and engine recorded for reproducibility.

### Workstream 3 — Local engine (Electron main process)

- Follows the established Electron media-operations pattern: pure functions with injectable binary paths, spawn with hard timeouts, fail-closed stderr capture. The engine is a standalone native super-resolution binary (Real-ESRGAN class, ncnn/Vulkan build) — no Python dependency.
- Capability probe at startup: Vulkan/GPU availability and memory decide local-capable vs. recommend-hosted; result cached and re-probed on failure.
- Model files fetched on first use with integrity verification, or bundled with the desktop installer — decision deferred to implementation, with bundle-size as the deciding factor.
- Engine parameters (scale, denoise strength) exposed as a small typed interface; defaults chosen for artwork, not photography.

### Workstream 4 — Hosted engine (Firebase Functions)

- A gateway-style callable that fronts a hosted super-resolution provider behind a provider interface, so the vendor is swappable without touching callers.
- Provider credentials live only in server config; the client never sees them (existing credentials policy applies).
- Cost estimation and reservation ride the existing enforce-operation-cost path with a new operation type for upscaling; idempotent job records prevent double-billing on retries.
- Returns a Storage-backed result URI; job state visible to the facade for progress and cancel.

### Workstream 5 — Tile-refine premium engine (Functions + background jobs)

- Long-running orchestration on the existing background-job system: base upscale (Workstream 3 or 4 output) → overlap-tile grid → per-tile generative detail pass through the existing image-edit gateway route → blended reassembly → Storage artifact.
- Tile-grid geometry, overlap blending, and seam-consistency guards are pure math extracted from orchestration so they are testable without network calls.
- Firestore-backed progress with per-tile granularity; the facade maps it to a single progress bar.
- Positioned and priced as a premium tier; requires explicit plan entitlement.

### Workstream 6 — Print-ready export (renderer)

- Extends the existing canvas export path with DPI metadata (PNG physical-resolution chunk and JPEG density), physical inch dimensions, and preset-driven export (media preset → exact pixel + DPI triple).
- Pre-export verdict from the PrintSpec planner shown in the export dialog: computed physical size at target DPI, with a warning state when the source cannot credibly reach the target.
- Deliberately small — the canvas foundation already exists; this is metadata and wiring.

## Testing Decisions

- Good tests here assert external behavior only: given source dimensions and a print target, what plan comes back; given a fake engine binary, does the executor spawn it with the right arguments and fail closed on bad exits; given a routing scenario, which engine is chosen. Internal data structures of the services are not asserted.
- Modules selected for unit tests in this build:
  - **PrintSpec planner** — pure math, highest regression risk, mirrors the existing pure crop-math test suite as prior art.
  - **Local executor** — spawn contract tested with fake binaries and injectable paths, mirroring the existing Electron media-executor test approach (timeout, non-zero exit, missing binary).
  - **Tile-refine geometry** — tile grid and blend math as pure tests with small fixtures.
  - **UpscalerService routing** — fake engines assert the routing and cost-check interactions, mirroring existing service-interaction tests.
- Hosted engine and tile-refine orchestration get contract tests at their boundaries (gateway callable, provider interface) using existing gateway test patterns. All of these are structural checks; per platform policy they never substitute for real-user validation of the actual print path.
- End-to-end: one Playwright path covering generate → plan → upscale (hosted, in CI) → export with DPI metadata verified on the output file.

## Out of Scope

- Training or fine-tuning a custom super-resolution model (integrating existing open models only).
- Vectorization/raster-to-vector conversion for flat logos (separate future consideration).
- Print fulfillment itself — no print-vendor ordering integration; this build produces print-ready files.
- Video upscaling.
- SynthID watermark handling — no claims made or attempted regarding watermark removal; upscalers process indii-generated art as-is.
- Full entitlement enforcement redesign for tier resolution declarations (Workstream 0 covers only the audit and the minimal enforce-or-remove decision).
- Mobile (the desktop app and web studio are the only surfaces in this build).

## Further Notes

- **Ceiling reality (verified in code):** the generation path already supports 512/1K/2K/4K end to end; there is no 1024 engine cap. Real gaps found: agent instrument declares 2048×2048; tier resolution declarations are display-only (never read in the generation path); Flash-tier max resolution disagrees between the renderer config (1K) and the server capability registry (4K). Workstream 0 exists to close these.
- **Provider ceiling is real:** Nano Banana Pro tops out at 4K output (~13.6″ at 300 DPI). Everything in this build exists to serve targets beyond that ceiling; nothing here raises the generation ceiling itself.
- **Cost shape (updated per owner directive, see #324/#325):** local engine ≈ free (user's electricity); hosted path = in-browser or self-hosted open source — no vendor bill (owner decision: no Replicate/fal.ai); tile-refine ≈ per-tile generative calls (Google today) or a self-hosted/fine-tuned refiner — option tracked in #325.
- **Build-our-own doctrine (owner directive 2026-09-26):** indii's own intelligence and infrastructure are always a first-class alternative to consuming vendors — never overlook it. Concrete form here: the platform's generation pipeline is a training-data factory (every 4K output is high-res ground truth; downsampling yields unlimited paired data for a domain-specific SR model), and the Vertex fine-tuning infrastructure already in-house is the same muscle. Tracked as #329 (dataset + baseline eval are zero-spend; training runs are owner-approval-gated).
- **Model distribution stance (recorded on #329):** stock open-source models ship to clients freely (desktop + browser — nothing to protect, free compute). The fine-tuned domain model is high-value IP and is therefore served from the Firebase backend (Cloud Run GPU, scale-to-zero) where artists receive results, never weights — client-side "locks" on a shipped model file are patchable and protect nothing. Premium tier prices this server-side engine against metered GPU-seconds via the existing cost-control path.
- **Print quality honesty:** super-resolution excels on AI-generated artwork; faces and small text are the known weak spots, which is the specific value proposition of the tile-refine tier.
- **Sequencing inside the build:** Workstream 0 and 6 first (config + export, both small), Workstream 1+2+3 as the core, Workstream 4 for web coverage, Workstream 5 last. Nothing built earlier is discarded by later workstreams — each composes with the previous.
