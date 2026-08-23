# MIG-003: FFmpeg direct-ops module (fast path)

Type: AFK · Blocked by: None — can start immediately · Stories: 2, 10

## Parent
docs/video/remotion-migration/PRD.md

## What to build
A deep module wrapping the repo's existing FFmpeg stack with the operations the RenderPlanner
will route as DIRECT MEDIA: µs-precision trim, transcode/rescale, audio replacement +
normalization, still extraction/probe. Simple media work must complete without ever touching
a browser or composition engine.

## Acceptance criteria
- [x] Ops implemented in main process: `probeMedia`, `trimToSpan` (µs, stream-copy), `transcodeRescale` (+fps), `replaceAudioTrack` (+loudnorm option), `extractThumbnail`, `makeScratchDir`
- [x] Integration tests generate runtime fixtures with the vendored binary and assert probed OUTPUT properties only — 7/7 pass
- [x] Pure spawn-based execution; no browser/Chromium anywhere in the module
- [x] Uses vendored `ffmpeg-static` + `ffprobe-static` (both already deps); binaries injectable for CI portability
Ops note: vendored binary was missing from node_modules (postinstall skipped) — ran its install script; pin/verify in CI to prevent recurrence.
