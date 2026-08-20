# 06 — Brand Positioning: The Canonical Tagline

> Applies to every indii.music surface: marketing site, studio app, metadata,
> PWA, collateral, investor and strategic-partner materials.

## Canonical pairing

```
indii.music
music business at the speed of you
```

The tagline is a **primary brand asset**, not temporary marketing copy. The
goal is a consistent association:

> indii.music — music business at the speed of you

## The canonical string — do not modify

`music business at the speed of you`

Rules:

- Always lowercase.
- No period.
- Do not prepend "the".
- Do not capitalize individual words.
- Do not paraphrase it.
- Do not shorten it.
- Do not create alternate versions for different surfaces.
- Preserve the wording exactly wherever the canonical tagline is used.

The single source of truth is `packages/shared/src/brand.ts`
(`INDII_BRAND.tagline`). UI code imports it; static surfaces (HTML
metadata, PWA manifests, PDF collateral) carry the identical string — a
grep for `music business at the speed of you` must find every canonical
use.

## What the tagline means

The central idea behind indii.music: the infrastructure of running a music
business should move at the artist's speed — rather than requiring the
artist to adapt to disconnected systems, paperwork, organizations,
platforms, and software.

Do not turn the tagline into explanatory copy. Let surrounding product
messaging explain it; the tagline itself stays short and exact.

## Surfaces

| Surface | Usage |
| --- | --- |
| Marketing/founder site (hero) | Brand lockup: `indii.music — music business at the speed of you` above the hero statement |
| Marketing/founder site (footer) | Tagline beneath the wordmark, once |
| Browser `<title>` / OG / social | `indii.music — music business at the speed of you` |
| PWA install metadata | Description begins with the canonical pairing |
| Structured data (JSON-LD) | `Organization.slogan` = tagline |
| Studio app | Launch/boot splash and the auth gate only — branding, not UI decoration |
| Local-funders booklet | Cover (beneath `indii.music`) and closing page |
| Merchandise | `design-assets/MERCH_BRAND_SYSTEM.md` (front double ii, back tagline) |

Legacy phrasing ("your independence operating system", "The operating
system for musical independence.") is retired from brand positions;
descriptive product prose may still use the word "operating system".

## Future investor / strategic-partner materials

The canonical pairing is the **default opening and closing positioning
line** for all future indii.music investor and strategic-partner
presentations:

- **Opening:** the pairing alone — `indii.music` / `music business at the
  speed of you` — before any explanation.
- **Closing:** the same pairing, unadorned.
- **Proof:** the presentation itself must demonstrate the promise of the
  tagline — the business infrastructure moving at the artist's speed —
  through the product's working architecture, not through claims.
