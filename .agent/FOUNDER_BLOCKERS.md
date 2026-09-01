# ⛔ FOUNDER BLOCKERS — Pick-Me-Up List

> **This is the single, always-current list of everything that stopped because it
> needs YOU (the founder) or an external asset/decision.** Every item says exactly
> what input is required and where the work lands once unblocked. All other plan
> workstreams are already built, tested, and green on `origin/main`.
>
> Living doc: a future agent or session reads this first. Updates go to
> `docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md` §19 + this file together.
>
> Updated: 2026-08-31

> **Founder tech policy (2026-08-31):** do not adopt third-party tech whose code or
> model weights are proprietary. Open-source only (MIT/Apache/etc.). This declines
> C2.3 (imgly weights are proprietary) and clears A1 (@vladmandic/human is MIT,
> @mediapipe is Apache-2.0).

## Why these are blocked (not skipped)
Per the repo's real-user-authenticity rule, I will not fabricate founder data,
download unlicensed model weights, or claim a real-path smoke passed when it didn't.
These are the honest remainder.

---

## 0. ⚡ QUICKEST WIN — one real likeness image unlocks A1
Give me your **verified selfie** (already in My Likeness, or upload one) + name one
**generated image of you** you consider correct. That's A1.5. I then:
- compute the **real** cosine/geometry similarity threshold on real pairs
- wire `FACE_LANDMARKER_MODEL_PATH` to a bundled `face_landmarker.task` so the
  degraded scorer actually runs
- ship the **real** `fuse_likeness` (A1.1 identity path if you also approve
  installing `@vladmandic/human`; else geometry-fit v1)

---

## Table: blocked items → what you must do

| # | Item | Phase | Input / decision YOU must give | Lands where (once unblocked) |
|---|------|-------|-------------------------------|------------------------------|
| 1 | A1.1 identity backend | A1 | Approve + allow installing `@vladmandic/human` (vendored weights) | `FacePipeline.loadHuman` real backend |
| 2 | A1.5 threshold calibration | A1 | **Your real likeness selfie + name one correct generated image of you** | real threshold in `LikenessFusionService.IDENTITY_SIMILARITY_THRESHOLD` |
| 3 | A1.7 panel smoke | A1 | eyeball the panel in Studio | `LikenessFusionPanel` live wiring |
| 4 | C2.3 split-subject | C2 | ❌ DECLINED (imgly weights proprietary; open-source-only policy) | n/a — build an open-source alternative if ever wanted |
| 5 | A2 pixel swap | A2 | License decision on `inswapper_128` (non-commercial) | Electron sidecar (desktop-only, default off) |
| 6 | E2 generative motion | E2 | Cost-approval to enable the gen-motion flag | `VITE_ENABLE_GEN_MOTION` gate |
| 7 | ~~C1.3 Fabric editor UI~~ | C1 | ✅ SHIPPED (2026-08-31, `678273f00`) | `CanvasEditor` components + `CanvasDocumentService` persistence + `useCanvasAutosave` |
| 8 | ~~C3 PSD export + text layer~~ | C3 | ✅ SHIPPED (2026-08-31, `8bd4d30c4`) | `PsdExportService` + text-layer rasterization + TypographyPanel "Add to Layer Editor" |

## Table: real-path smokes (founder eyeball / browser / real assets needed)
Each needs the founder to run it against a real asset (structural/local tests already
green). I can walk you through each when you're at the machine.

| Smoke | What to open/do |
|-------|-----------------|
| G1.6 | 3000×3000 master → full platform matrix + zip opens clean|
| F1.4 | your cover → vinyl + tee mockup; fidelity eyeball |
| E1.5 | one still → dolly-in 4s 1080×1920 plays on a phone viewport |
| H1.3 | fuse → adjust in canvas → export; version tree shows all 3, revert works |
| D2.3 | on-brand + off-brand asset through your Brand Kit → compliance report |
| B2.3 | upload your brand font → render a wordmark, compare to font's own metrics |
| A1.7 | pick IMG_4488 → fuse onto a generated subject → score shown |
| C2.4 | open generated cover → cool bg 0.3 / warm subject 0.15 / move wordmark → export (zero generation calls) |
| I1.6 | release master → DSP bundle validated against Spotify/Apple specs |

---

## How to hand me a blocker
Reply with the item number(s) and the input. E.g. **"A1.5 — here's my selfie; 'this' is me: <image>"** or **"C2.3 — approved, use @imgly"**. I'll pick it up immediately.
