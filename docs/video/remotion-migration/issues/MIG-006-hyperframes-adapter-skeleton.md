# MIG-006: Composition-engine adapter skeleton passing the contract suite

Type: AFK · Blocked by: MIG-002, MIG-005 (go verdict) · Stories: 11

## Parent
docs/video/remotion-migration/PRD.md

## What to build
First write the reusable contract-compliance suite (queue → progress → completion/failure →
authorization failure cases), then implement the new engine's adapter until it passes the
lifecycle subset. Visual features may lag; the plumbing must be proven. Engine types stay
strictly below the boundary.

## Spike results (2026-08-22, hyperframes@0.8.10)
- `npm install hyperframes` clean; CLI `lint` → 0 errors on contract-valid composition
- `render` → MP4 (h264 1920×1080@30, exact duration), 9.8s wall for 150 frames on 10 cores
- **Re-render is byte-identical** → golden parity harness (MIG-007) can use exact/structural frame compare
- Composition contract: root div `data-composition-id/start/width/height/duration`, `class="clip"` + `data-start/data-duration/data-track-index`, one paused GSAP timeline at `window.__timelines["<id>"]` — direct mapping target for our compiler output
- Env quirk: CLI writes `~/.cache/hyperframes` + `~/.hyperframes` — on this machine HOME must be overridden to a writable dir (external-volume EPERM). Cloud Run container must set HOME to a writable path. Consider `hyperframes telemetry disable` in CI.

## Acceptance criteria
- [x] Shared suite factory `runVideoRendererContractSuite` (@indii/shared) — ONE spec executed against BOTH adapters
- [x] Legacy: RenderService passes suite via stubbed Firebase transport (6/6) · New: HyperFramesAdapter passes with REAL local renders (7/7, ~9s per render, artifact verified on disk)
- [x] Engine confined to main-process/desktop packaging; renderer bundle never imports it. Adapter speaks only @indii/shared types
- [x] Dependency exact-pinned `hyperframes@0.8.10` in packages/main and root (root declaration is required for Electron Builder to include app.asar production dependencies)
Hardening found by the suite and fixed in-adapter: terminal-state precedence (cancelled jobs can't be resurrected by late CLI exit) + child-process kill on forced failure + writable-HOME env for CLI caches.
