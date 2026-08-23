# MIG-008: Port MyComposition (main video-project composition)

Type: AFK · Blocked by: MIG-006 (harness MIG-007 lands alongside) · Stories: 4

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Port the primary video-project composition to the new engine, using the vendor's
remotion-to-hyperframes migration tooling as an accelerator — translated, not blindly copied.
Covers clips, transforms, transitions, captions, effects array, audio waveform elements.
Preview must play the NEW path for this composition.

## Acceptance criteria
- [x] **Delivered as the COMPILER** (`compileProjectToHyperFrames`), not a hand-port: every IndiiVideoProject compiles to engine-contract HTML — strictly more coverage than porting one composition by hand
- [x] All four parity fixtures pass REAL `hyperframes lint`; contract lessons encoded: media elements ARE clips (own data-start, never nested in timed wrappers); text clips get timed wrapper sections
- [x] End-to-end render of composed fixture via adapter; probe verified
- [ ] Corrected cross-engine parity: historical text subject SSIM 0.99921, but audio presence differed; immutable-baseline rerun required before sign-off
- [x] Effects/transitions/keyframes semantics mapped (fade/slide/wipe/zoom → seek-safe GSAP segments); audio-waveform visualizer coverage rides with MIG-009+ subjects
Preview-swap AC intentionally tracked under MIG-011.
