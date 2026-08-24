# PRD: Video Engine Abstraction & Remotion Removal

> Status: IMPLEMENTED LOCALLY with corrected parity signed; optional cloud composition activation remains approval-gated.
> Parents: [ADR-001](./ADR-001-video-engine-abstraction.md), [INVENTORY.md](./INVENTORY.md).
> Publishing to an external tracker requires explicit request + credentials (repo skill policy).

## Problem Statement

Artists and editors using indii's Video Studio depend on a rendering engine whose licensing
becomes a paid contract once the company crosses size/revenue thresholds. Every composition,
preview, cloud render, agent workflow and build script was coupled to that engine. As
video grows toward ~30% of the product surface, that coupling is an existential commercial
risk and an architectural one: the product's video semantics live inside someone else's
framework instead of inside indii.

## Solution

Make indii.music the video platform. One framework-neutral project model and renderer
contract owned by indii; engines underneath are replaceable. Work routes through two paths —
simple media operations go straight to FFmpeg (fast, no browser), composed visual work goes
to a pluggable composition engine (first HyperFrames, later an indii-owned engine). Remotion
was intended to remain as a legacy adapter until parity. A later founder directive removed
it first; the parity ledger therefore requires immutable retired-engine baseline artifacts.

## User Stories

### Artists & editors
1. As an artist, I want my video projects saved in indii's own format, so that my work never depends on a third party's license terms.
2. As an artist, I want trims, transcodes and audio swaps to complete faster, so that simple edits don't wait on heavyweight machinery.
3. As an editor, I want preview playback that matches final export, so that what I see is what renders.
4. As an editor, I want transitions, animated titles, waveforms and overlays to keep working during and after the migration, so that nothing I rely on disappears.
5. As an artist, I want cloud renders delivered to my library exactly as before (same receipts, same storage locations), so that the change is invisible to me.
6. As a mobile/social creator, I want vertical release promos assembled from album art, footage, captions and audio, so that promo production stays one-click.

### AI agents
7. As the video-producer agent, I want to describe video work in indii's project vocabulary, so that I am not hard-coupled to a rendering vendor.
8. As the conductor agent, I want render requests to return the same lifecycle receipts as today, so that job orchestration keeps working unchanged.
9. As an agent author, I want one documented API surface for "make this video", so that skills stay valid across future engine swaps.

### Engineering & business
10. As the founder, I want zero revenue- or headcount-triggered licenses in the video stack, so that growth never triggers a vendor squeeze.
11. As a platform engineer, I want a single contract that any composition engine must pass, so that swapping engines is verification work, not archaeology.
12. As a platform engineer, I want build configuration free of engine-specific aliases and chunks, so that builds can't silently break when packages change.
13. As a developer, I want golden reference outputs per fixture project, so that engine parity is measurable, not argued.
14. As a developer, I want Remotion removable in one clean sweep at the end, so that no dead code or config lingers to confuse future agents.
15. As an operator, I want cloud rendering to remain on Google Cloud (Cloud Run + GCS), so that infrastructure, auth and billing stay consolidated.
16. As a security reviewer, I want render inputs authorized owner-scoped end-to-end regardless of engine, so that the migration cannot open access holes.

## Implementation Decisions

- **IndiiVideoProject (shared):** the existing editor project model is promoted into the
  shared package as `IndiiVideoProject` and becomes the only source of truth. Frame positions
  remain the editor timeline representation, while microseconds are canonical for source trims.
- **Renderer contract:** preserve the existing async receipt protocol verbatim
  (`renderId/projectId/progress/status/asset/expiresAt`). Engines implement this contract;
  contract types may not leak upward.
- **Two execution paths via RenderPlanner:** DIRECT MEDIA operations (trim, transcode,
  resize, normalize, audio replacement) route to FFmpeg directly and never enter a browser;
  COMPOSED VISUAL operations (multi-scene assembly, animated typography, overlays, waveforms,
  transitions) route to the composition-engine adapter, whose output finishes through FFmpeg.
- **Composition engine:** first candidate is HyperFrames, gated on license verification
  (permissive, no usage-triggered clauses) and a hands-on spike confirming distributed
  rendering on Google Cloud Run with GCS object storage. The local adapter is implemented;
  the cloud adapter/deployment remains blocked on founder cost approval.
- **Preview:** the official HyperFrames Player presents a seekable live composition compiled
  from the same `IndiiVideoProject` and compiler used by export. The most recent rendered MP4
  remains a delivery/failure fallback rather than the primary editing surface.
- **Cloud topology:** unchanged provider direction — local Electron renders and Google Cloud
  Run workers (Chromium + engine + FFmpeg) writing to GCS. No AWS introduction.
- **Agents:** producer/conductor skills and MCP tools speak `IndiiVideoProject` and the
  renderer contract; engine names disappear from operational documentation.
- **Deletion order:** Remotion packages, compositions, env vars, deploy scripts, browser
  mocks, and dual vite-config aliases/chunks are removed together in one final lockstep
  change, gated on a repo-wide zero-hit search of production code.

## Testing Decisions

- **Test external behavior only:** a good test feeds a project definition in and asserts on
  the receipt stream and the produced artifact (duration, dimensions, streams, sync), never
  on internal call graphs.
- **Contract compliance suite:** one reusable suite asserts queue, progress, completion,
  failure, and receipt-field behavior against `RenderService` and `HyperFramesAdapter`.
  Authorization remains the responsibility of the cloud transport boundary.
- **Golden parity harness:** fixture projects render through both paths; compare duration,
  dimensions, sampled frames (structural similarity threshold), and audio synchronization.
  Parity sign-off is the deletion gate.
- **FFmpeg direct ops:** unit-tested against short fixture media; assert output probes
  (codec, duration, tracks) rather than pixel content.
- **Prior art in repo:** the approval-to-timeline compiler tests, render receipt parsing
  tests, and creative-video interaction tests set the house style.

## Out of Scope

- Any new user-facing editing features (pure engine migration).
- Replacing video.js playback/buffering.
- Implementing the eventual indii-owned engine (this PRD only establishes the boundary).
- Mobile clients and external public APIs.
- Motion Canvas adoption or migration (confirmed absent from the codebase).

## Further Notes

- Supersedes the 2026-06-26 "keep Remotion" decision (see ADR-001); the anti-hand-rolling
  spirit of that decision is retained — we add engines behind contracts, not ad-hoc code.
- HyperFrames licensing, local adapter maturity, and corrected cross-engine parity are
  verified. The only remaining external proof is an approved Cloud Run deployment/GCS
  round trip.
