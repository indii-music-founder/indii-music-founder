## OUTCOME

> COMPLETE FOR RETAINED SCOPE: the standalone 16:9 port remains and is signed,
> while the two additional formats were deleted by founder directive.

# MIG-009: Port LogoReveal composition family

Type: AFK · Blocked by: MIG-008 (pattern established) · Stories: 4

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Port the LogoReveal variant family following the MIG-008 pattern. Each variant gets a parity
report line item.

## Acceptance criteria
- [x] **Subject 1/3 (`LogoReveal` 16:9): ported** — spring/interpolate→GSAP mapping pattern established
- [x] Corrected parity rerun for 16:9 using committed `docs/assets/LogoReveal.mp4`: SSIM 0.97177, structural pass under the documented silent-AAC/container-padding exception
- [x] `LogoRevealSquare` / `LogoRevealVertical` deliberately deleted by founder directive
- [x] No production callers retain the deleted composition IDs
Port source: packages/main/src/services/video/hyperframes/ports/LogoReveal.html
