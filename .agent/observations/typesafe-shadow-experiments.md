# TypeSafe shadow experiments — 2026-09-23T18:29:31.590Z

Evidence class: **local-real (live API, labeled synthetic fixtures) — not production proof** · model `jev-latest` · 26 requests · 16061 in / 3609 out tokens · 52.1s total

## A. Foundry column semantics (16 fixtures)

| header | truth | shipped baseline | jev | jev conf |
|---|---|---|---|---|
| ISRC | isrc | isrc ✓ | isrc ✓ | 1 |
| UPC | upc | upc ✓ | upc ✓ | 1 |
| Fee Amount | fee_amount | fee_amount ✓ | fee_amount ✓ | 0.95 |
| Net Receipts | currency_amount | generic_number ✗ | currency_amount ✓ | 1 |
| Units | quantity_count | quantity_count ✓ | quantity_count ✓ | 0.97 |
| Sales Month | us_date | iso_date ✗ | generic_text ✗ | 0.42 |
| Reporting Date | iso_date | iso_date ✓ | iso_date ✓ | 1 |
| Territory | territory_code | territory_code ✓ | territory_code ✓ | 1 |
| Store | dsp_name | dsp_name ✓ | dsp_name ✓ | 1 |
| Artist | artist_name | artist_name ✓ | artist_name ✓ | 1 |
| Track Title | track_title | track_title ✓ | track_title ✓ | 1 |
| Album Title | album_title | generic_text ✗ | album_title ✓ | 1 |
| Transaction Type | transaction_type | generic_text ✗ | transaction_type ✓ | 1 |
| ISWC | iswc | generic_text ✗ | iswc ✓ | 1 |
| Streams | stream_count | quantity_count ✗ | stream_count ✓ | 1 |
| Downloads | download_count | generic_number ✗ | download_count ✓ | 1 |

Baseline 9/16 · Jev 15/16
Jev fixes baseline: `Net Receipts`, `Album Title`, `Transaction Type`, `ISWC`, `Streams`, `Downloads`
Jev regressions: —

## B. Sync mood classification (10 fixtures)

| tag | truth | shipped baseline | jev | jev conf |
|---|---|---|---|---|
| happy | [Upbeat] | [Upbeat] ✓ | [Upbeat] ✓ | 0.99 |
| unhappy | [∅] | [∅] ✓ | [Melancholic] ✗ | 0.97 |
| lovelorn | [∅] | [∅] ✓ | [Melancholic] ✗ | 0.85 |
| dark-pop | [Dark] | [Dark] ✓ | [Dark] ✓ | 0.97 |
| epic orchestral | [Cinematic] | [Cinematic] ✓ | [Cinematic] ✓ | 0.92 |
| chill | [Chill] | [Chill] ✓ | [Chill] ✓ | 0.99 |
| somber sad piano | [Melancholic] | [Melancholic] ✓ | [Melancholic] ✓ | 1 |
| hype | [Energetic] | [Energetic] ✓ | [Energetic] ✓ | 0.76 |
| experimental industrial glitched noise | [∅] | [∅] ✓ | [Dark] ✗ | 0.78 |
| romantic dinner jazz | [Romantic] | [Romantic] ✓ | [Romantic] ✓ | 0.99 |

Baseline 10/10 · Jev 7/10
Jev fixes baseline: —
Jev regressions: `unhappy`, `lovelorn`, `experimental industrial glitched noise`

