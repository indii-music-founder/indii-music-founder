# MIG-001: Promote IndiiVideoProject to the shared package

Type: AFK · Blocked by: None — can start immediately · Stories: 1, 7

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Promote the editor's existing project model into the shared package as `IndiiVideoProject`,
the single framework-neutral source of truth for video projects. Frame values remain the
stored editor timeline coordinates for persistence compatibility; optional microseconds are
the canonical source-trim coordinates. Engine-specific types are removed. The approval→timeline compiler moves with it,
semantics unchanged. The editor store consumes the shared type. End-to-end behavior: existing
projects load, edit, save, and compile exactly as before — nothing user-visible changes.

## Acceptance criteria
- [x] `IndiiVideoProject` lives in the shared package; renderer imports it via compatibility aliases in the editor store (all 37 existing call sites untouched)
- [x] Zero engine types in the schema; field names kept as generic film vocabulary to keep persisted docs stable (decision documented in file header)
- [x] µs canonical for source trimming; `usToFrames`/`framesToUs` helpers added while persisted frame timeline fields remain stable
- [x] Compiler tests pass unmodified (18/18) · renderer `tsc --noEmit` clean · shared `tsc --noEmit` clean
- [x] No persistence-shape change → load/save lossless by construction
Follow-up hardening (post-MIG-002): enforce derive-on-write for frame fields in store reducers.
