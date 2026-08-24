# Golden Parity Sign-Off Ledger

> The harness report is evidence, not an automatic approval. A cross-engine row
> passes only when its SSIM threshold **and** structural gates pass: duration,
> dimensions, frame rate, video presence, and audio presence/duration.

| Composition | Fixture coverage | Evidence date | Frozen baseline → current | Visual score | Structural result | Verdict | Signed |
|---|---|---|---|---|---|---|---|
| `VideoProject` text (`crossengine-text-001`) | typography/timing | 2026-08-23 | pre-removal source at `e1b09d76f^` rendered with exact 4.0.484 → compiler/HyperFrames | [SSIM 0.99921](./parity/crossengine-text-001-2026-08-24T00-22-31-514Z.md) (≥0.90) | **PASS:** dimensions/FPS/video match; duration Δ48ms | **within threshold** | **YES — 2026-08-23** |
| `LogoReveal` (`crossengine-logoreveal-001`) | logo animation | 2026-08-23 | committed `docs/assets/LogoReveal.mp4` (`a43710f…`, commit `76e663b9c`) → ported GSAP/HyperFrames | [SSIM 0.97177](./parity/crossengine-logoreveal-001-2026-08-24T00-21-33-969Z.md) (≥0.90) | **PASS:** dimensions/FPS/video match; duration Δ56ms under documented 60ms codec-padding tolerance | **within threshold** | **YES — 2026-08-23** |

The 2026-08-24 UTC reports are the corrected sign-off evidence. Historical
reports remain under `parity/` for audit history but are superseded by the rows
above. The text baseline was rebuilt outside the repository from the exact last
pre-removal source and package version; its SHA-256 was
`e068bc5f1f9c7c2c435c3669f1fdc50a8024551e570760b05ea880ff9af4aa8f`.
No retired-engine package or composition was restored to the repository.

## Methodology

- Within-engine: byte-hash frame identity, with ratio 1.0 required.
- Cross-engine: global FFmpeg SSIM for pixels, default threshold 0.90.
- Both modes: video presence, dimensions, FPS, and duration drift (default ≤50ms)
  must pass. Audio presence must match by default; when both sides have audio,
  available audio-stream duration must also remain within the duration tolerance.
- A visual-only fixture may relax audio presence with measured proof that the
  extra baseline stream is silent. Both signed rows use retired-renderer AAC
  silence measured by FFmpeg `volumedetect` at mean/max `-91.0 dB`; the current
  engine correctly omits that meaningless track.
- LogoReveal permits 60ms duration drift because the legacy AAC container adds
  56ms while both video streams are exactly 5,000ms.

## Gauge calibration

| Date | Control | Expected | Observed | Result |
|---|---|---|---|---|
| 2026-08-22 | same engine, same composition ×2 | identical | ratio 1.0, structural match | PASS |
| 2026-08-22 | perturbed composition | mismatch | frame differences detected | PASS |

Current status: calibration is valid and both retained cross-engine subjects are
approved under the corrected structural and SSIM gates.
