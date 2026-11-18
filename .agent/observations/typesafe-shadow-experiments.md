# TypeSafe shadow experiments — 2026-11-18T14:28:43.243Z

Evidence class: **local-real (live API, labeled synthetic fixtures) — not production proof** · model `jev-latest` · 26 requests · 17301 in / 3739 out tokens · 6.9s total

## A. Foundry column semantics (16 fixtures)

| header | truth | shipped baseline | jev | jev conf |
|---|---|---|---|---|
| ISRC | isrc | isrc ✓ | isrc ✓ | - | undefined |
| UPC | upc | upc ✓ | upc ✓ | - | undefined |
| Fee Amount | fee_amount | fee_amount ✓ | fee_amount ✓ | - | undefined |
| Net Receipts | currency_amount | generic_number ✗ | currency_amount ✓ | - | undefined |
| Units | quantity_count | quantity_count ✓ | quantity_count ✓ | - | undefined |
| Sales Month | us_date | iso_date ✗ | generic_text ✗ | - | undefined |
| Reporting Date | iso_date | iso_date ✓ | iso_date ✓ | - | undefined |
| Territory | territory_code | territory_code ✓ | territory_code ✓ | - | undefined |
| Store | dsp_name | dsp_name ✓ | dsp_name ✓ | - | undefined |
| Artist | artist_name | artist_name ✓ | artist_name ✓ | - | undefined |
| Track Title | track_title | track_title ✓ | track_title ✓ | - | undefined |
| Album Title | album_title | generic_text ✗ | album_title ✓ | - | undefined |
| Transaction Type | transaction_type | generic_text ✗ | transaction_type ✓ | - | undefined |
| ISWC | iswc | generic_text ✗ | iswc ✓ | - | undefined |
| Streams | stream_count | quantity_count ✗ | stream_count ✓ | - | undefined |
| Downloads | download_count | generic_number ✗ | download_count ✓ | - | undefined |

Baseline 9/16 · Jev 15/16
Jev fixes baseline: `Net Receipts`, `Album Title`, `Transaction Type`, `ISWC`, `Streams`, `Downloads`
Jev regressions: —

## B. Sync mood classification (10 fixtures)

| tag | truth | shipped baseline | jev | mood applies (noul) | decision |
|---|---|---|---|---|---|
| happy | [Upbeat] | [Upbeat] ✓ | [Upbeat] ✓ | 0.74 | choice |
| unhappy | [∅] | [∅] ✓ | [∅] ✓ | 0.54 | unsettled_baseline |
| lovelorn | [∅] | [∅] ✓ | [∅] ✓ | 0.55 | unsettled_baseline |
| dark-pop | [Dark] | [Dark] ✓ | [Dark] ✓ | 0.47 | unsettled_baseline |
| epic orchestral | [Cinematic] | [Cinematic] ✓ | [Cinematic] ✓ | 0.65 | unsettled_baseline |
| chill | [Chill] | [Chill] ✓ | [Chill] ✓ | 0.98 | choice |
| somber sad piano | [Melancholic] | [Melancholic] ✓ | [Melancholic] ✓ | 0.81 | choice |
| hype | [Energetic] | [Energetic] ✓ | [Energetic] ✓ | 0.71 | choice |
| experimental industrial glitched noise | [∅] | [∅] ✓ | [∅] ✓ | 0.15 | no_mood |
| romantic dinner jazz | [Romantic] | [Romantic] ✓ | [Romantic] ✓ | 0.84 | choice |

Baseline 10/10 · Jev 10/10
Jev fixes baseline: —
Jev regressions: —

