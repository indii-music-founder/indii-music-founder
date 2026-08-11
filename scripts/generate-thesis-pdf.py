#!/usr/bin/env python3
"""Generate the downloadable indii thesis presentation PDF."""

from __future__ import annotations

import shutil
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
TMP_PDF = ROOT / "tmp" / "pdfs" / "the-indii-thesis.generated.pdf"
OUTPUT_PDF = ROOT / "output" / "pdf" / "the-indii-thesis.pdf"
PUBLIC_PDF = ROOT / "packages" / "landing" / "public" / "downloads" / "the-indii-thesis.pdf"

PAGE_WIDTH = 960
PAGE_HEIGHT = 540
MARGIN_X = 62

BLACK = HexColor("#050505")
WHITE = HexColor("#FFFFFF")
AMBER = HexColor("#FFB800")
MUTED = HexColor("#8A8F9E")
RULE = Color(1, 1, 1, alpha=0.14)


def draw_background(pdf: canvas.Canvas, page_number: int, section: str) -> None:
    pdf.setFillColor(BLACK)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    # Quiet, deterministic signal points keep the PDF related to the viewer
    # without recreating the old faux-cinematic title treatment.
    pdf.setFillColor(Color(1, 1, 1, alpha=0.12))
    for index in range(16):
        x = 22 + ((index * 137 + page_number * 41) % 916)
        y = 22 + ((index * 83 + page_number * 67) % 496)
        radius = 0.55 if index % 3 else 0.9
        pdf.circle(x, y, radius, stroke=0, fill=1)

    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.7)
    pdf.line(MARGIN_X, PAGE_HEIGHT - 40, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 40)
    pdf.line(MARGIN_X, 37, PAGE_WIDTH - MARGIN_X, 37)

    pdf.setFont("Courier-Bold", 7.5)
    pdf.setFillColor(AMBER)
    pdf.drawString(MARGIN_X, PAGE_HEIGHT - 30, "THE INDII THESIS")
    pdf.setFillColor(Color(1, 1, 1, alpha=0.36))
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 30, section.upper())
    pdf.drawString(MARGIN_X, 22, "NEW DETROIT MUSIC LLC / FOUNDER EDITION")
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 22, f"{page_number:02d}")


def wrap_lines(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_paragraphs(
    pdf: canvas.Canvas,
    paragraphs: list[str],
    *,
    x: float,
    y: float,
    width: float,
    font_size: float = 14,
    leading: float = 21,
    color: Color = MUTED,
    paragraph_gap: float = 12,
) -> float:
    pdf.setFillColor(color)
    pdf.setFont("Helvetica", font_size)
    cursor = y
    for paragraph in paragraphs:
        for line in wrap_lines(paragraph, "Helvetica", font_size, width):
            pdf.drawString(x, cursor, line)
            cursor -= leading
        cursor -= paragraph_gap
    return cursor


def draw_kicker(pdf: canvas.Canvas, text: str, x: float, y: float) -> None:
    pdf.setFont("Courier-Bold", 8)
    pdf.setFillColor(AMBER)
    pdf.drawString(x, y, text.upper())


def draw_heading(pdf: canvas.Canvas, lines: list[str], x: float, y: float, accent_line: int = -1) -> float:
    size = 48 if len(lines) <= 2 else 42
    leading = size * 0.87
    pdf.setFont("Helvetica-Bold", size)
    cursor = y
    for index, line in enumerate(lines):
        pdf.setFillColor(AMBER if index == accent_line else WHITE)
        pdf.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def draw_pull_quote(pdf: canvas.Canvas, text: str, x: float, y: float, width: float) -> None:
    pdf.setStrokeColor(AMBER)
    pdf.setLineWidth(2)
    pdf.line(x, y + 7, x, y - 76)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.setFillColor(WHITE)
    cursor = y
    for line in wrap_lines(text, "Helvetica-Bold", 18, width - 24):
        pdf.drawString(x + 22, cursor, line)
        cursor -= 25


def draw_cover(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 1, "Founder thesis / 01")
    draw_kicker(pdf, "Everything to everybody", MARGIN_X, 438)

    pdf.setFont("Helvetica-Bold", 86)
    pdf.setFillColor(WHITE)
    pdf.drawString(MARGIN_X, 334, "The indii")
    pdf.setFillColor(AMBER)
    pdf.drawString(MARGIN_X, 258, "thesis.")

    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.8)
    pdf.line(MARGIN_X, 206, PAGE_WIDTH - MARGIN_X, 206)

    draw_paragraphs(
        pdf,
        [
            "Why independent artists do not need one more isolated tool. They need the work around the music to understand the work beside it.",
        ],
        x=MARGIN_X,
        y=170,
        width=610,
        font_size=17,
        leading=25,
        color=Color(1, 1, 1, alpha=0.68),
    )
    pdf.setFont("Courier-Bold", 8)
    pdf.setFillColor(Color(1, 1, 1, alpha=0.38))
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 105, "WIIL, FOUNDER / DETROIT / 2026")


def draw_intro(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 2, "I / The argument")
    draw_kicker(pdf, "Episode I / The argument", MARGIN_X, 438)
    draw_heading(pdf, ["The conventional", "advice breaks here."], MARGIN_X, 388, 1)
    draw_paragraphs(
        pdf,
        [
            "The conventional startup playbook says: build for somebody, not everybody. You cannot be everything to everyone.",
            "That is true in most industries. But an independent artist does not need one thing. They need every part of a working music business at once.",
        ],
        x=548,
        y=384,
        width=350,
        font_size=13.5,
        leading=20,
        color=Color(1, 1, 1, alpha=0.62),
    )
    draw_pull_quote(pdf, "indii is the infrastructure without the surrender.", MARGIN_X, 176, 700)


def draw_what_indii_is(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 3, "II / What indii is")
    draw_kicker(pdf, "Episode II / What indii is", MARGIN_X, 438)
    draw_heading(pdf, ["One workspace.", "Artist controlled."], MARGIN_X, 388, 1)
    draw_paragraphs(
        pdf,
        [
            "indii is an operating workspace for independent music artists. Not a recording program. Not a streaming service. It is where the work around a music career can live together.",
            "Distribution, audio, creative direction, rights, finance, publishing, licensing, campaigns, publicity, touring, merchandise, security, and the project record work from the same artist-controlled context.",
            "The artist remains the owner, the decision-maker, and the source of truth.",
        ],
        x=532,
        y=384,
        width=366,
        font_size=12.8,
        leading=18.5,
        color=Color(1, 1, 1, alpha=0.62),
        paragraph_gap=10,
    )
    draw_pull_quote(pdf, "indii is the conductor and the orchestra.", MARGIN_X, 160, 630)


def draw_operating_advantage(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 4, "III / Operating advantage")
    draw_kicker(pdf, "Episode III / The operating advantage", MARGIN_X, 438)
    draw_heading(pdf, ["Context moves", "with the work."], MARGIN_X, 388, 1)
    draw_paragraphs(
        pdf,
        [
            "Most music-business tools solve one isolated task. The artist is left carrying information from one system to the next and repairing the gaps by hand.",
            "indii starts with shared project context. When rights information changes, the release record can reflect it. When the route changes, the working budget and show record can move with it.",
            "Files, notes, voice memos, receipts, locations, assets, and approvals become part of the same working record. The next move begins with context instead of another blank form.",
        ],
        x=532,
        y=384,
        width=366,
        font_size=12.7,
        leading=18,
        color=Color(1, 1, 1, alpha=0.62),
        paragraph_gap=9,
    )


def draw_yagni(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 5, "IV / YAGNI")
    draw_kicker(pdf, "Episode IV / The YAGNI philosophy", MARGIN_X, 438)
    draw_heading(pdf, ["Build the spine.", "Reuse the truth."], MARGIN_X, 388, 1)
    draw_paragraphs(
        pdf,
        [
            "You Aren't Gonna Need It - until you do. indii is built around reusable operating capabilities: projects, files, records, approvals, plans, and the connections between them.",
            "A release does not need a special version of your ownership data. A tour does not need a separate version of your artist identity. The same reliable source should serve every part of the work.",
            "That is how the product can grow without asking the artist to rebuild their career inside every new feature.",
        ],
        x=532,
        y=384,
        width=366,
        font_size=12.8,
        leading=18.5,
        color=Color(1, 1, 1, alpha=0.62),
        paragraph_gap=10,
    )


def draw_moat(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 6, "V / Competitive moat")
    draw_kicker(pdf, "Episode V / The competitive moat", MARGIN_X, 438)
    draw_heading(pdf, ["The artist stops", "starting over."], MARGIN_X, 388, 1)
    draw_paragraphs(
        pdf,
        [
            "The music industry is full of useful single-purpose tools. The problem begins when none of them understand what happened in the tool beside them. The artist becomes the integration layer.",
            "indii is designed so approved visual direction can inform the campaign, the route can inform the working budget, and the rights record can stay attached to the release it governs.",
        ],
        x=548,
        y=384,
        width=350,
        font_size=13.2,
        leading=19.5,
        color=Color(1, 1, 1, alpha=0.62),
    )
    draw_pull_quote(pdf, "The advantage is not one more feature. It is the end of starting over.", MARGIN_X, 164, 720)


def draw_leverage(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 7, "VI / Artist leverage")
    draw_kicker(pdf, "Episode VI / The artist keeps the leverage", MARGIN_X, 438)
    draw_heading(pdf, ["Infrastructure,", "not ownership."], MARGIN_X, 388, 1)
    draw_paragraphs(
        pdf,
        [
            "A system cannot write the song, guarantee an audience, or manufacture a career. It can remove the administrative drag that keeps talent from getting a fair chance to move.",
            "The bedroom producer in Detroit should not need a label-sized staff before they can organize a release, understand the business, and protect the work.",
        ],
        x=548,
        y=384,
        width=350,
        font_size=13.2,
        leading=19.5,
        color=Color(1, 1, 1, alpha=0.62),
    )
    draw_pull_quote(pdf, "Give the artist the infrastructure. Keep the ownership with the artist.", MARGIN_X, 164, 740)


def draw_closing(pdf: canvas.Canvas) -> None:
    draw_background(pdf, 8, "Closing")
    draw_kicker(pdf, "The founder edition", MARGIN_X, 438)
    draw_heading(pdf, ["Build your career", "without giving it away."], MARGIN_X, 378, 1)

    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.8)
    pdf.line(MARGIN_X, 236, PAGE_WIDTH - MARGIN_X, 236)

    draw_paragraphs(
        pdf,
        [
            "One workspace for the work behind the music. The artist owns the work, directs the decisions, and keeps the leverage.",
        ],
        x=MARGIN_X,
        y=196,
        width=610,
        font_size=17,
        leading=25,
        color=Color(1, 1, 1, alpha=0.66),
    )
    pdf.setFont("Helvetica-Bold", 21)
    pdf.setFillColor(AMBER)
    pdf.drawString(MARGIN_X, 104, "YOU need indii.music.")
    pdf.setFont("Courier-Bold", 8)
    pdf.setFillColor(Color(1, 1, 1, alpha=0.34))
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 104, "WIIL, FOUNDER / DETROIT")


def build_pdf(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(path), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
    pdf.setTitle("The indii Thesis")
    pdf.setAuthor("wiil, Founder - New Detroit Music LLC")
    pdf.setSubject("Everything to Everybody - the founder thesis for indii.music")
    pdf.setCreator("indii.music")

    pages = [
        draw_cover,
        draw_intro,
        draw_what_indii_is,
        draw_operating_advantage,
        draw_yagni,
        draw_moat,
        draw_leverage,
        draw_closing,
    ]
    for index, draw_page in enumerate(pages):
        draw_page(pdf)
        if index < len(pages) - 1:
            pdf.showPage()
    pdf.save()


def main() -> None:
    # Ensure a stale partial artifact is never copied into either delivery path.
    TMP_PDF.parent.mkdir(parents=True, exist_ok=True)
    if TMP_PDF.exists():
        TMP_PDF.unlink()

    build_pdf(TMP_PDF)
    for destination in (OUTPUT_PDF, PUBLIC_PDF):
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(TMP_PDF, destination)

    print(f"Generated {OUTPUT_PDF.relative_to(ROOT)}")
    print(f"Generated {PUBLIC_PDF.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
