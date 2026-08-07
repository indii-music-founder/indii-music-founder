# indii — Icon Colorways

A 14-colorway family. Every tile is the same recipe at a different hue, so
nothing in the set drifts lighter or more saturated than the master green and
reads as candy beside it.

Do not hand-edit the SVGs. They are generated:

```bash
node design-assets/generate-icons.mjs
```

`generate-icons.mjs` is the single source of truth for the recipe, the hue
list, and which colorway each surface uses.

## The recipe

```
tile top    = hsl(H,     68%, 53%)
tile bottom = hsl(H + 7, 83%, 24%)
ink panel   = hsl(H,     60%,  6%)
mark        = #3BEAF0 -> #12C6D4      identical in every colorway
```

The recipe is lifted from the master brand green. Rotating hue only — never
saturation or lightness — is what keeps the family level. The shared cyan mark
is the other half of that; do not re-tint it per colorway.

## Geometry (512×512)

| Element | Spec |
| --- | --- |
| Tile | `rect 0,0,512,512` — `rx="115"` |
| Ink panel | `rect 72,72,368,368` — `rx="104"`, 12px mark-gradient stroke |
| Dots | `r="29"` at `cx=218` / `cx=294`, `cy=155` |
| Stems | `58×178`, `rx="29"`, at `x=189` / `x=265`, `y=208` |

The colored border is 72px — deliberately narrow, so the mark carries as much
of the tile as possible and survives downscaling.

## The family

Contrast columns are measured (WCAG 2.x relative luminance). **mark/ink** uses
the dark end of the mark gradient (`#12C6D4`) — the worst case.

| Colorway | Hue | Tile top | Tile bottom | Ink panel | mark/ink | ink/tile | Surface |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lime` | 95 | `#7AD936` | `#29700A` | `#0E1806` | 8.73:1 | 2.97:1 | — |
| `grass` | 112 | `#4BD936` | `#0C700A` | `#091806` | 8.78:1 | 2.92:1 | — |
| `kelly` | 128 | `#36D94B` | `#0A7024` | `#061809` | 8.80:1 | 2.94:1 | — |
| `spring` | 141 | `#36D96F` | `#0A703A` | `#06180D` | 8.79:1 | 2.96:1 | **Web** |
| `emerald` | 155 | `#36D995` | `#0A7052` | `#061811` | 8.77:1 | 3.01:1 | — |
| `jade` | 168 | `#36D9B8` | `#0A7068` | `#061815` | 8.75:1 | 3.07:1 | — |
| `teal` | 190 | `#36BDD9` | `#0A5370` | `#061518` | 8.91:1 | 2.20:1 | — |
| `azure` | 212 | `#3682D9` | `#0A2E70` | `#060F18` | 9.23:1 | 1.50:1 | — |
| `indigo` | 230 | `#3651D9` | `#0A0F70` | `#060918` | 9.48:1 | 1.24:1 | **Electron** |
| `violet` | 252 | `#5636D9` | `#2B0A70` | `#0A0618` | 9.56:1 | 1.31:1 | — |
| `purple` | 275 | `#9536D9` | `#520A70` | `#110618` | 9.46:1 | 1.54:1 | — |
| `orchid` | 300 | `#D936D9` | `#700A64` | `#180618` | 9.33:1 | 1.78:1 | **Remote** |
| `magenta` | 320 | `#D936A2` | `#700A42` | `#180612` | 9.36:1 | 1.69:1 | — |
| `rose` | 338 | `#D93671` | `#700A24` | `#18060D` | 9.39:1 | 1.64:1 | — |

## Reading the contrast columns

**mark/ink** is uniform across the family (8.73–9.56:1) and clears WCAG AA for
non-text graphics (3:1) several times over. The mark is never at risk.

**ink/tile** is not uniform, and that is physics rather than a defect. Blue
contributes only 0.0722 to relative luminance against green's 0.7152, so at
identical HSL lightness a blue tile bottom and a blue ink panel sit far closer
in luminance than their green equivalents. Greens land near 3:1; blues and
purples fall to 1.24–1.78:1.

What this means in practice: on the cooler colorways the cyan stroke — not the
fill difference — is what separates panel from tile. That is exactly how the
master icon reads too, so it is faithful rather than broken. The consequence is
that the cooler tiles depend on the stroke surviving. Flattening a colorway to
a format that drops or thins the stroke will hurt `indigo` and `violet` well
before it hurts `spring`.

Equalizing `ink/tile` across hues would require lifting the tile bottoms on the
cool end, which would visibly change colorways that are already approved. Not
done.

## Small sizes

The set holds from roughly 24px up. At 16px the 12px stroke and the gap between
the two stems collapse and the icon reads as a solid colored square. A true
16px favicon needs a separate simplified cut — drop the ink panel, put the mark
straight on the tile. **That asset does not exist yet.**

## Files

```
design-assets/
  generate-icons.mjs      source of truth — regenerates everything below
  favicon-web.svg         spring
  favicon-electron.svg    indigo
  favicon-remote.svg      orchid
  colorways/*.svg         all 14, one file per colorway
  icon-comparison.html    full family sheet, open directly in a browser
```

## Not yet wired up

These are source assets only. Still outstanding:

- Web manifest + `<link rel="icon">` in `packages/renderer`
- Rasterization to `.icns` / `.ico` / PNG set for Electron packaging
- Separate manifest for the Remote/mobile PWA
- 16px simplified cut (see above)
