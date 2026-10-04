# Print master engine and durable resolution correction

## Observed gaps

The local-native print preparation delivery at `2904c961c8ad4d59dc3c9d5ab0ce477425aa01a4`
claimed browser AI support, but `PrintReadyUpscaleService` still used browser
interpolation and silently fell back after desktop engine errors. Its JSON
metadata did not activate StorageService's legacy `meta === 'upscale'` master
upload path, allowing ordinary smartSave compression to reduce 3000px masters
to 2048px. The two history-producing UI handlers reported success before their
asynchronous store persistence finished.

## Correction

- Decode owned source bytes through the existing storage bridge before canvas
  or enhancement, avoiding reliance on display-only remote image URLs.
- Select actual desktop RealESRGAN or existing tiled browser ESRGAN when source
  pixels are insufficient. Preserve the full image before focal cropping.
- Refuse unsupported enlargement and insufficient engine output. Report engine
  failure instead of labeling interpolation as AI enhancement.
- Identify sufficient existing pixels separately from AI enlargement.
- Mark print masters with `preserveResolution`, upload their original bytes,
  and await durable history persistence before UI success.

## Evidence and limits

Pure dimension-planning tests pass (11 cases). Root typecheck passes; root lint
passes with 0 errors and 217 warnings. Final touched-file lint passes with
0 errors and 1 pre-existing component export warning. Full local CI passes:
four shards, 9,337 tests passed. The diff quality scan and whitespace check pass. Existing
mock-backed suites remain structural-only. No new mocks were added; the touched
service test now checks only pure logic with literal dimensions.

Jev performed a live source review: 5,940 input tokens and 78 output tokens.
Answers are typed advisory probabilities, not evidence of production behavior.
See `2026-10-04-jev-print-engine-review.json`; the API returned no dollar cost.

Production browser enhancement, downloaded pixel dimensions/density, and
durability after reload remain unverified for this correction. This does not
complete the wider print acceptance plan, cloud worker acceptance, fresh image
generation, free-tier journey, or the two-week completion goal.
