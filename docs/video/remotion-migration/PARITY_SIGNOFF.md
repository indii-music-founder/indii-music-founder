# Golden Parity Sign-Off Ledger

> The harness report is evidence, not an automatic approval. A cross-engine row
> passes only when its SSIM threshold **and** structural gates pass: duration,
> dimensions, frame rate, video presence, and audio presence/duration.

| Composition | Fixture coverage | Evidence date | Frozen baseline → current | Visual score | Structural result | Verdict | Signed |
|---|---|---|---|---|---|---|---|
| `VideoProject` text (`crossengine-text-001`) | typography/timing | 2026-08-23 | retired local renderer → compiler/HyperFrames | SSIM 0.99921 (≥0.90) | **FAIL:** baseline audio=true, current audio=false; duration Δ48ms | **mismatch under current gate** | **NO — rerun required** |
| `LogoReveal` (`crossengine-logoreveal-001`) | logo animation | 2026-08-23 | retired local renderer → ported GSAP/HyperFrames | SSIM 0.97203 (≥0.90) | **FAIL:** baseline audio=true, current audio=false; duration Δ56ms exceeds default 50ms | **mismatch under current gate** | **NO — rerun required** |

The historical JSON/Markdown reports remain under `parity/` unchanged. They are
not valid sign-offs under the corrected gate. Re-signing requires an immutable
baseline MP4 supplied to the parity scripts with `--baseline=...`; the retired
engine and its packages are deliberately not reintroduced.

## Methodology

- Within-engine: byte-hash frame identity, with ratio 1.0 required.
- Cross-engine: global FFmpeg SSIM for pixels, default threshold 0.90.
- Both modes: video presence, dimensions, FPS, and duration drift (default ≤50ms)
  must pass. Audio presence must match by default; when both sides have audio,
  available audio-stream duration must also remain within the duration tolerance.
- A fixture may relax audio presence only with documented proof that the extra
  stream is silent. The existing reports contain no such proof.

## Gauge calibration

| Date | Control | Expected | Observed | Result |
|---|---|---|---|---|
| 2026-08-22 | same engine, same composition ×2 | identical | ratio 1.0, structural match | PASS |
| 2026-08-22 | perturbed composition | mismatch | frame differences detected | PASS |

Current status: calibration is valid; cross-engine sign-off has **zero approved
rows** pending baseline-artifact reruns.
