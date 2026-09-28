# Print-ready image handoff

Status: implementation in progress. A generated file is **not** called press-ready until its actual bytes pass preflight and the selected printer's current template is checked.

## Production failure found on 2026-09-28

- The live browser generated a genuine 1024 × 1024 asset and correctly requested a 2.93× increase for a 3000 × 3000 distributor cover.
- The only gallery super-resolution command called the native Electron bridge, so a web user received no new image.
- Print Size Check stretched the source directly and failed before download because Firebase's displayed image tainted the canvas (`SecurityError: toDataURL`).
- The previous preset model had no bleed or safe area, and the dialog did not separate a print plan from a validated print file.

## Handoff rules

| Destination | Trim / print area | Bleed and safety | Resolution and color | Handoff |
| --- | --- | --- | --- | --- |
| Digital distributor cover | 3000 × 3000 square pixels | No physical bleed | Verify actual pixel dimensions; sRGB artwork | Separate digital file; never reuse a bleed canvas as the distributor upload. |
| Vinyl jacket / record packaging | Manufacturer-specific dieline; 12.375-inch square is a planning trim only | Default 0.125 inch per side with 0.125-inch minimum safe margin, overridden by actual template | 300 PPI art; press CMYK PDF, fonts embedded/outlined where required | The exact vendor dieline governs spine, folds, glue areas, labels, and cutouts. A generic square cannot certify a complete jacket. |
| CD packaging | Exact Disc Makers product template | Typically 0.125-inch bleed; safe zone from template | 300 PPI; PDF/X-4 CMYK is recommended by Disc Makers | Use the template for each front/back panel and spine. |
| General flyer / poster | Selected finished paper size | Default 0.125-inch bleed and 0.125-inch safe margin; confirm printer template | 300 PPI planning baseline; printer may demand CMYK and a different density | Send a proof and confirm crop marks, PDF standard, color conversion, and paper stock. |
| GotPrint flyer | Product-specific size and template | 0.125-inch bleed; safe zone from template | 350 DPI, CMYK, 75 MB maximum | Use its downloadable template and review the proof. |
| Printful apparel | Product-specific print area | Follow product template and safe area; no universal paper bleed | sRGB PNG for transparent DTG/DTF designs; 150–300 DPI varies by product | Check each product's File guidelines; avoid semi-transparent edges. |

Sources: [Disc Makers CD guide](https://www.discmakers.com/resources/getting-cd-cover-dimensions-right), [Disc Makers jacket requirements](https://www.discmakers.com/products/jackets), [GotPrint flyer specifications](https://www.gotprint.com/products/flyers/info.html), [Printful file preparation](https://help.printful.com/hc/en-us/articles/50264019148177-How-should-I-prepare-my-print-file-for-the-best-results), [Printful safe area](https://help.printful.com/hc/en-us/articles/50264024409233-What-is-the-safe-print-area).

## Acceptance gates

1. The real app creates a source through the visible user flow and measures the returned bytes, never the prompt label.
2. A web or desktop upscale returns an asset whose measured width and height meet the chosen target. Cloud reference enhancement must be labelled as generative and reviewed for changed text, faces, and fine details.
3. Export refuses a low-resolution source. The downloaded file's encoded dimensions and density match the target, including bleed: a 10 × 10-inch trim with 0.125-inch bleed at 300 PPI needs 3075 × 3075 pixels.
4. Bleed and safe margins are visible in the print plan. The exported image contains artwork through the bleed edge; essential content stays within the safe zone by artist review.
5. A printer-specific job is marked *ready for that printer* only after its template, color profile, page geometry, fonts, and accepted format are verified. A raster PNG is not presented as a CMYK PDF/X-4 file.
6. Repeat the full production browser path on a genuine account and inspect the actual downloaded image bytes. A local test or mock-backed browser suite is structural evidence only.

## Remaining production work

- Add vendor dieline import and proof overlays for vinyl jackets, CD packaging, folded work, and labels. Template geometry varies too much for one universal preset.
- Add press PDF with bleed/trim boxes and an explicit CMYK output-intent workflow; do not claim PDF/X compliance until a preflight tool validates it.
- Add a fidelity-preserving hosted super-resolution provider for web users. Current cloud fallback uses reference-guided 4K generation, which can change detail and cannot cover every large-format target.
- Add actual source-content safe-zone checks where text and logo layers are available, plus file-size and transparency checks for product uploads.
