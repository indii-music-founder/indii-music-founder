## OUTCOME

> PARTIAL BY FOUNDER DIRECTIVE: the standalone 16:9 port remains, while the two
> additional formats were deleted with the engine. The historical SSIM score is
> retained as evidence but is not signed under the corrected structural/audio gate.

# MIG-009: Port LogoReveal composition family

Type: AFK · Blocked by: MIG-008 (pattern established) · Stories: 4

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Port the LogoReveal variant family following the MIG-008 pattern. Each variant gets a parity
report line item.

## Acceptance criteria
- [x] **Subject 1/3 (`LogoReveal` 16:9): ported** — spring/interpolate→GSAP mapping pattern established
- [ ] Corrected parity rerun for 16:9 using an immutable baseline (historical SSIM 0.97203 failed structural/audio gates)
- [x] `LogoRevealSquare` / `LogoRevealVertical` deliberately deleted by founder directive
- [x] No production callers retain the deleted composition IDs
Port source: packages/main/src/services/video/hyperframes/ports/LogoReveal.html
