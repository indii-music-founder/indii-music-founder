# ADR-001: Video Engine Abstraction & Remotion Removal

**Status:** Accepted; local implementation and corrected parity complete, optional cloud activation approval-gated
**Date:** 2026-08-22
**Supersedes:** Founder decision 2026-06-26 — "Do not hand-roll media buffering or replace Remotion's render/composition role with video.js."
**Companion:** [INVENTORY.md](./INVENTORY.md)

## Context

Video is ~30% of indii.music surface area and growing. Before this migration:

- **Remotion 4.0.484** owns render/composition: two composition roots, `<Player />` previews,
  Electron local rendering (`ElectronRenderService`), Cloud Run/GCS cloud rendering
  (a legacy deploy script and engine-specific environment variables), an engine-named MCP tool,
  agent SOPs, and build-config entanglement in **two** vite configs.
- **video.js** owns playback/buffering.
- **FFmpeg** (`ffmpeg-static`, `fluent-ffmpeg`) does stitching/extraction/transcode.
- `VideoProject` (in `videoEditorStore.ts`) is already ~framework-neutral, with a
  deterministic approval→timeline compiler using µs precision.
- `RenderService.ts` already speaks a framework-neutral async receipt protocol
  (`renderId/projectId/progress/asset/expiresAt`) over a Firestore callable.

**Why leave Remotion:** it is source-available, not open source. Free use ends at a
team-size/revenue threshold, beyond which a paid Company License applies. This is an
unacceptable lock-in curve for a company whose video surface is becoming core product.

**Strategic intent:** the end state is not "Remotion swapped for another vendor."
The end state is that **indii.music is the video platform** — it owns the project model,
editor semantics, AI interface, routing and renderer contracts — with engines underneath
that are replaceable by design:

```
Phase now:   Remotion  ──►  HyperFrames (open source)
Phase later: HyperFrames ──►  indii-owned engine
```

A minimum of **two** engine swaps is therefore planned. The abstraction boundary is the
only permanent artifact of this migration.

## Decision

1. **indii.music owns the video platform layer.**
   - `IndiiVideoProject` becomes the single framework-neutral source of truth,
     promoted from the existing `VideoProject` into `packages/shared`.
     Frame coordinates remain the editor timeline representation; µs values are the
     canonical source-trim coordinates and are converted only at execution boundaries.
   - No engine's types may leak upward across the renderer boundary.

2. **Engines are pluggable, behind one boundary.**
   - `VideoRenderer` contract preserves the existing receipt protocol verbatim.
   - `RenderPlanner` routes work between two paths:
     - **DIRECT MEDIA → FFmpeg**: trims, transcodes, normalization, audio replacement,
      format/resize operations. Never enters Chromium.
     - **COMPOSED VISUAL → composition engine**: animated typography, overlays,
       waveforms, transitions, multi-scene assembly. Enters Chromium, exits via FFmpeg.
   - Composition engine candidates must satisfy requirement 3.

3. **Open-source mandate (hard requirement).**
   Any new engine dependency must be permissively licensed (MIT / Apache-2.0 / BSD)
   with **no revenue-, headcount-, or usage-triggered commercial clauses**.
   First candidate: **HyperFrames** — pending verification of its actual LICENSE file
   (go/no-go gate before any porting work begins).

4. **The planned removal gate was parity-first.**
   Order: freeze contract → introduce adapters (LEGACY Remotion + NEW) → port
   compositions one-by-one → golden render tests (same project through both paths;
   compare duration, dimensions, frame samples, audio sync) → move preview off
   `<Player />` → move Cloud Run off `@remotion/cloudrun` (staying on Google Cloud:
   Cloud Run Jobs + GCS; no AWS introduction) → re-point agents at `IndiiVideoProject`
   API → only then delete packages, configs, env vars, scripts, mocks, docs references.

   **Implementation variance:** the founder subsequently directed immediate removal.
   Seven unported preset variants (two additional LogoReveal formats and five banner
   animations) were deleted. The general project compiler replaces their production
   composition-ID surface, but this does not count as fixture-by-fixture parity.

## Consequences

**Positive**
- Engine swaps become configuration/boundary work, not rewrites.
- FFmpeg fast path removes needless Chromium renders for simple media ops.
- Licensing risk eliminated permanently, including at the future own-engine stage.
- Three.js/generative visual work can feed composed video through one architecture.

**Costs / risks**
- Dual-path maintenance window until parity is proven (golden tests are the exit gate).
- Both vite configs must change in lockstep or builds break (INVENTORY §6).
- If HyperFrames fails the license check, fallbacks must be decided consciously:
  stay on Remotion short-term, composition-via-FFmpeg-only, or alternate OSS engine.

## Alternatives considered

- **Stay on Remotion, pay the license.** Rejected: lock-in curve worsens as video share grows.
- **Replace with video.js.** Rejected (and correctly so in 2026-06-26): wrong tool;
  playback layer, not a compositor. That decision remains true and is *not* superseded
  in spirit — we still do not hand-roll buffering. Only the "keep Remotion" clause ends.
- **Big-bang rewrite without boundary.** Rejected: detonates a working editor and
  provides no parity mechanism.

## Verification items before adapter work (blockers)

1. HyperFrames LICENSE file inspected and passes mandate (§13 INVENTORY).
2. HyperFrames distributed-render claim on Google Cloud Run Jobs + GCS confirmed hands-on.
3. Golden-test harness feasibility agreed (pixel-level vs structural comparison).

---

## Addendum 2026-08-22: Gate verdict — **GO** (MIG-005 passed)

Verified directly against the `heygen-com/hyperframes` repo (main branch):

1. **License: PASS.** `LICENSE` is the complete, unmodified **Apache License 2.0**.
   No revenue-, headcount-, or usage-triggered commercial clauses. README's own
   comparison table confirms: "Apache 2.0" vs Remotion's "Source-available Remotion License."
2. **GCP distributed rendering: CAPABILITY CONFIRMED; deployment pending.** The pinned
   pinned `hyperframes@0.8.10` exposes `cloudrun deploy/sites/render/progress/destroy`, and the
   official `@hyperframes/gcp-cloud-run@0.8.11` package publishes a Node SDK, container,
   and Terraform module. The adapter package is not yet installed because no paid GCP
   deployment or authenticated GCS round trip has been approved. AWS is not introduced.
3. **Migration tooling: CONFIRMED.** `/remotion-to-hyperframes` skill ships in-repo
   ("Porting an existing Remotion (React) composition's source to HyperFrames HTML").
4. Note: HeyGen also offers a hosted `cloud render` service — **not used**; we run the
   local renderer today. Managed Cloud or an indii-owned Cloud Run deployment remain
   explicit infrastructure choices, not a separate AI agent architecture.

MIG-006 (local adapter) is complete. MIG-012 remains approval-gated and the Firebase
cloud entry point fails closed for composed projects until a cloud adapter is implemented,
deployed, and smoke-tested.
