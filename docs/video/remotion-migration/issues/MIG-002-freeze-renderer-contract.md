# MIG-002: Freeze the VideoRenderer contract

Type: AFK · Blocked by: MIG-001 · Stories: 5, 8, 11

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Extract the renderer contract — including the async receipt protocol
(`renderId/projectId/status/progress/asset/expiresAt`) — into the shared package. The legacy
Remotion path becomes an adapter implementing this contract; the orchestrator and services
depend on the contract only. This is the freeze: from here on, no engine type may leak above
the boundary, and every future engine must satisfy the same surface.

## Acceptance criteria
- [x] `VideoRendererContract` + verbatim receipt protocol in @indii/shared (`types/videoRenderer.ts`); zero engine imports
- [x] `RenderService implements VideoRendererContract`; renderer-facing names (`RenderConfig`, `VideoRenderReceipt`, `RenderResult`) are aliases — all importers untouched
- [x] Orchestrator/StoryboardTimeline/useVideoEditor compile against the aliased surface unchanged
- [x] 24/24 tests pass (RenderService receipt lifecycle + store suites); renderer full tsc exit 0; shared build refreshed
Note: `compositionId` remains a generic compatibility field; RenderPlanner decides the execution profile from project semantics.
