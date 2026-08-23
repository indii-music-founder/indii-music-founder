# MIG-004: RenderPlanner router (DIRECT vs COMPOSED)

Type: AFK · Blocked by: MIG-002, MIG-003 · Stories: 2, 6

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Pure routing layer: inspect a render request/project and classify each unit of work as
DIRECT MEDIA (FFmpeg fast path) or COMPOSED VISUAL (renderer contract). The decision is
recorded on the job document for observability. Trims/transcodes of uploaded footage must
 demonstrably skip the composition engine entirely.

## Acceptance criteria
- [x] Pure router in @indii/shared (`planRenderRoute`), with table-driven rule and fail-closed coverage (`VideoRouteError` reasons)
- [x] Direct jobs execute FFmpeg-only end-to-end via `MediaJobExecutor` (main process) — composed routes are REFUSED at this seam; no engine import on the direct path
- [x] Composed routing target = renderer contract; dispatch wiring lands with gateway/Cloud Run cutover (MIG-012)
- [x] `decisionToJobMetadata()` flattens decisions to persisted job-doc fields (`videoRoute` / `videoOp` / `routeReason`)
Routing rules (ordered): explicit op → no-input/empty-project fail-closed → text/effects/layout → image overlay → track controls/audio timeline → multi-clip → timeline offset → single-clip trim/passthrough.
