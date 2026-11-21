# Water-optics droplets: rebuild plan (2026-11-21)

**Status:** planned, not started. **Owner:** William. **Branch context:** removed from the landing in `design/declutter-landing-passport` so it can come back better.

## What existed
`RainGlassOverlay` (+ `.css`), mounted on the home route only: a fixed, full-viewport layer at `z-index: 10000` with 14 hard-coded droplets and a `backdrop-filter` lens. Mobile (<= 640px / coarse pointer) fell back to fewer droplets, no animation, no blur. Recoverable from commit `5d16dacb7`:

```bash
git show 5d16dacb7:packages/landing/src/components/effects/RainGlassOverlay.tsx
git show 5d16dacb7:packages/landing/src/components/effects/RainGlassOverlay.css
```

## Why it came out (design review, 2026-11-21)
- It sat above everything, so drops landed on pricing cards and body text and read as smudges.
- A full-viewport `backdrop-filter` layer repaints on scroll; cost is paid on a conversion page.
- Positions were hand-typed percentages, so the effect looked identical on every viewport.

## Goals for the rebuild
1. Real teardrops: pear shape, a refraction highlight, a short trail where a drop has slid.
2. Never reduce legibility: no drop over body copy, prices, form fields or buttons.
3. Pay for it once: scoped to the hero, not the whole page.

## Approach
- **Scope:** render inside the hero section (`position: absolute`, below text `z-index`), not `fixed` at 10000.
- **Refraction without a full-screen filter:** per-drop radial gradient + small inline SVG `feDisplacementMap` on the drop only; no page-wide `backdrop-filter`.
- **Placement:** generate positions from the hero's measured box and keep a text-safe mask (headline, subhead, CTA row are exclusion zones).
- **Motion:** slow slide for a few drops on desktop only; static on mobile and when `prefers-reduced-motion` or `prefers-reduced-transparency` is set.
- **Budget:** <= 10 drops, no layout shift, no long tasks; pause when the hero is offscreen (IntersectionObserver).

## Acceptance criteria
- Hero LCP and CLS within 5% of the current declutter branch (measure before and after).
- Contrast of headline, subhead and buttons unchanged (axe passes).
- Reduced-motion and mobile render a static, still-attractive version.
- Unit test for the exclusion mask; visual check at 390 / 768 / 1440.

## Open questions for William
- Hero only, or also on the Passport page?
- Keep any sitewide trace (one or two drops) or hero only?
