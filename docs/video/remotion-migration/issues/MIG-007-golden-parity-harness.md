# MIG-007: Golden parity harness

Type: AFK · Blocked by: MIG-006 · Stories: 13

## Parent
docs/video/remotion-migration/PRD.md

## What to build
The measuring stick: render fixture projects through LEGACY and NEW adapters and produce a
comparison report — duration, dimensions, sampled frames (structural similarity threshold),
audio synchronization offsets. First subject is the first ported composition (MIG-008).
Parity sign-off per composition is the deletion gate for the legacy path.

## Acceptance criteria
- [x] Fixtures defined as canonical IndiiVideoProject JSON: `single-trim` (µs cut), `text-title`, `overlay-fx` (overlay+filter+transition), `captions` (3-clip rail) — waveforms ride with MIG-008's audio coverage
- [x] `runParityComparison()` engine-agnostic (inject LEGACY/NEW render callbacks) → judged result; `writeParityReports()` emits human markdown + machine JSON per run; thresholds configurable per run
- [x] Sign-off ledger live at docs/video/remotion-migration/PARITY_SIGNOFF.md (manual updates from reports; calibration record seeded)
- [x] Calibration covers positive control (same comp ×2 → `identical`), negative control (perturbed → `mismatch`), report content, thresholds, and visually-identical/audio-mismatched rejection
- [ ] Cross-engine rows re-signed under current structural/audio gate using immutable baseline artifacts
