#!/usr/bin/env python3
"""Update the indii.music local-funders booklet with the canonical tagline.

Edits the existing booklet PDF in place (no redesign): the cover sub-head
becomes the canonical two-line tagline directly beneath "indii.music", the
closing-page strapline becomes the canonical tagline, and the cover version
label is bumped (V3 -> V4 to match the v4 filename).

Canonical tagline (PRIMARY BRAND ASSET — do not alter wording/case):
    music business at the speed of you

Rules enforced here: lowercase only, no period, no "the" prefix, exact wording.

Usage:
    python3 scripts/update-local-funders-booklet.py [INPUT.pdf] [OUTPUT.pdf]

Defaults:
    INPUT  = ~/Downloads/indii_music_local_booklet_v4.pdf
    OUTPUT = output/pdf/indii_music_local_booklet_v4.pdf

Requires PyMuPDF (pymupdf). Install once:
    pip install pymupdf
"""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf

TAGLINE = "music business at the speed of you"
TAGLINE_LINE_1 = "music business"
TAGLINE_LINE_2 = "at the speed of you"

INK = (0.03137254901960784, 0.03137254901960784, 0.03137254901960784)  # #080808
MUTED_INK = (0.09411764705882353, 0.09411764705882353, 0.09411764705882353)  # #181818
GRAY = (0.3333333333333333, 0.3333333333333333, 0.3333333333333333)  # #555555
PAPER = (1, 1, 1)


def find_span(page: pymupdf.Page, needle: str) -> dict | None:
    """Return the first span whose text starts with needle."""
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                if span["text"].strip().startswith(needle):
                    return span
    return None


def replace_spans(page: pymupdf.Page, replacements: list[tuple[str, str, str, tuple]]) -> None:
    """Batch-replace spans on one page: redact all first, then insert all.

    The source spans' line boxes overlap vertically, so every redaction rect
    must be applied in a single pass before any new text is inserted.
    replacements: list of (needle, replacement_text, fontname, color).
    """
    found: list[tuple[dict, str, str, tuple]] = []
    for needle, replacement, fontname, color in replacements:
        span = find_span(page, needle)
        if span is None:
            raise RuntimeError(f"span not found on page {page.number + 1}: {needle!r}")
        found.append((span, replacement, fontname, color))

    for span, _replacement, _fontname, _color in found:
        page.add_redact_annot(pymupdf.Rect(span["bbox"]), fill=PAPER)
    page.apply_redactions()

    for span, replacement, fontname, color in found:
        page.insert_text(
            pymupdf.Point(span["origin"]),
            replacement,
            fontname=fontname,
            fontsize=span["size"],
            color=color,
        )


def main() -> int:
    default_input = Path.home() / "Downloads" / "indii_music_local_booklet_v4.pdf"
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_input
    output_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else Path(__file__).resolve().parents[1] / "output" / "pdf" / "indii_music_local_booklet_v4.pdf"
    )

    if not input_path.exists():
        print(f"input PDF not found: {input_path}")
        return 1

    doc = pymupdf.open(str(input_path))
    if doc.page_count != 15:
        print(f"unexpected page count {doc.page_count} (expected 15) — aborting")
        return 1

    # ── Cover (page 1): sub-head becomes the canonical tagline, two lines,
    #    common left edge (mirrors the merch back treatment). ─────────────
    cover = doc[0]
    replace_spans(
        cover,
        [
            ("Run your music career", TAGLINE_LINE_1, "hebo", INK),
            ("without giving it away.", TAGLINE_LINE_2, "hebo", INK),
            # Version label: V3 -> V4 (matches the v4 filename).
            ("Local founder briefing", "Local founder briefing \u00b7 V4", "helv", GRAY),
        ],
    )

    # ── Closing page (15): strapline becomes the canonical tagline. ──────
    closing = doc[14]
    replace_spans(
        closing,
        [("The operating system for musical independence.", TAGLINE, "helv", MUTED_INK)],
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path), garbage=3, deflate=True)
    doc.close()

    # Verify the canonical string extracts verbatim from the updated PDF.
    check = pymupdf.open(str(output_path))
    full_text = "".join(page.get_text() for page in check)
    if TAGLINE not in full_text:
        print("VERIFICATION FAILED: canonical tagline missing from updated PDF")
        return 1
    check.close()

    print(f"updated booklet written to {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
