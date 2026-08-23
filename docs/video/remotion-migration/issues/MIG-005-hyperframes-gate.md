# MIG-005: HyperFrames go/no-go gate (LICENSE + spike)

Type: HITL · Blocked by: None — runs in parallel from day one · Stories: 10, 15

## Parent
docs/video/remotion-migration/PRD.md · Mandate: ADR-001 §Decision.3

## What to build
Human verification of the candidate engine before any porting investment:
1. Inspect the actual LICENSE file in the HyperFrames repository (not marketing copy).
   Verdict against the mandate: permissive (MIT/Apache/BSD), zero revenue-/headcount-/usage-triggered clauses.
2. Hands-on local spike: render a minimal HTML composition to MP4 with deterministic output.
3. Verify (or refute) the installed CLI surface for Google Cloud Run/GCS; deployment proof remains a separate approval gate.
4. Record verdict + evidence as an addendum to ADR-001. If FAIL: choose fallback consciously (stay-on-legacy / FFmpeg-only composition / alternate OSS engine).

## Acceptance criteria
- [x] License text quoted in ADR addendum with explicit pass/fail vs mandate — **Apache-2.0, PASS**
- [x] Installed `hyperframes@0.8.10` CLI exposes Cloud Run deploy/render/progress/site commands; authenticated deployment remains MIG-012
- [x] Go/no-go decision recorded; fallback named if no-go — **GO** (ADR-001 addendum, 2026-08-22)
- [x] Spike artifact exists — `/tmp/hf-spike/output.mp4`: h264 1920×1080@30, 150 frames, 5.000s exact, rendered in 9.8s; **byte-identical re-render (MD5 match) → deterministic**
