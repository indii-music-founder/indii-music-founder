## OUTCOME

> RESOLVED BY SCOPE CHANGE: all five banner variants were deliberately deleted by
> founder directive; the compiler covers arbitrary projects instead of named presets.

# MIG-010: Port BannerAnimations composition family

Type: AFK · Blocked by: MIG-009 · Stories: 4

> STATUS: closed without ports — 5 variants (Cinematic/ZoomThrough/Orbit/Glitch/Pulse).

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Port the banner animation compositions (~700+ lines; largest family). If granularity demands,
sub-split per banner variant — decide at implementation time based on parity failures.

## Acceptance criteria
- [x] Five old preset implementations removed by explicit scope decision
- [x] No production callers retain their composition IDs
- [x] General compiler supports equivalent project-authored animation primitives
