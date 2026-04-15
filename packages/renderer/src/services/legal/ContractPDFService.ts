/**
 * ContractPDFService
 *
 * Converts markdown contract content into a professionally formatted PDF.
 * Uses jsPDF for client-side generation — no server round-trip required.
 * The generated PDF can be saved to disk or opened in a new tab.
 */

import { jsPDF } from 'jspdf';
import { logger } from '@/utils/logger';

// ── Page Geometry ──────────────────────────────────────────────────────
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 25;
const MARGIN_RIGHT = 25;
const MARGIN_TOP = 30;
const MARGIN_BOTTOM = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// ── Typography ─────────────────────────────────────────────────────────
const FONT_BODY = 'helvetica';
const FONT_SIZE_H1 = 18;
const FONT_SIZE_H2 = 14;
const FONT_SIZE_H3 = 12;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_FOOTER = 7;
const LINE_HEIGHT_MULTIPLIER = 1.6;

export interface PDFGenerateOptions {
    /** Document title (shown in PDF metadata & header) */
    title: string;
    /** Markdown content of the contract */
    content: string;
    /** Optional subtitle (e.g., "DRAFT — For Review Only") */
    subtitle?: string;
    /** Optional filename (without extension) */
    filename?: string;
}

export class ContractPDFService {

    /**
     * Generate a PDF from contract content and trigger a browser download.
     */
    static download(options: PDFGenerateOptions): void {
        const doc = ContractPDFService.generate(options);
        const filename = (options.filename ?? ContractPDFService.slugify(options.title)) + '.pdf';
        doc.save(filename);
        logger.info(`[ContractPDF] Downloaded: ${filename}`);
    }

    /**
     * Generate a PDF and open it in a new browser tab.
     */
    static preview(options: PDFGenerateOptions): void {
        const doc = ContractPDFService.generate(options);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Revoke after 60s to free memory
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        logger.info(`[ContractPDF] Preview opened for: ${options.title}`);
    }

    /**
     * Generate a PDF and return it as a Blob (for attaching to emails, etc.)
     */
    static toBlob(options: PDFGenerateOptions): Blob {
        const doc = ContractPDFService.generate(options);
        return doc.output('blob');
    }

    /**
     * Generate a PDF and return it as a Base64-encoded string (for email attachments).
     * Returns pure Base64 without the data URI prefix.
     */
    static toBase64(options: PDFGenerateOptions): string {
        const doc = ContractPDFService.generate(options);
        // jsPDF output('datauristring') returns "data:application/pdf;filename=generated.pdf;base64,<BASE64>"
        const dataUri = doc.output('datauristring');
        // Strip the data URI prefix to get raw Base64
        const base64 = dataUri.split(',')[1] ?? dataUri;
        return base64;
    }

    // ── Core renderer ──────────────────────────────────────────────────
    private static generate(options: PDFGenerateOptions): jsPDF {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        // PDF Metadata
        doc.setProperties({
            title: options.title,
            subject: options.subtitle ?? 'Legal Contract',
            creator: 'indiiOS Legal Department',
            author: 'indiiOS',
        });

        let y = MARGIN_TOP;
        let pageNum = 1;

        // ── Helper: Add new page if needed ──────────────────────────
        const checkPageBreak = (neededHeight: number) => {
            if (y + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                addFooter(doc, pageNum);
                doc.addPage();
                pageNum++;
                y = MARGIN_TOP;
            }
        };

        // ── Header ──────────────────────────────────────────────────
        // Brand bar
        doc.setFillColor(20, 20, 30);
        doc.rect(0, 0, PAGE_WIDTH, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont(FONT_BODY, 'bold');
        doc.text('indiiOS LEGAL DEPARTMENT', MARGIN_LEFT, 12);
        doc.setFontSize(7);
        doc.setFont(FONT_BODY, 'normal');
        doc.text('AI-Powered Contract Analysis', PAGE_WIDTH - MARGIN_RIGHT, 12, { align: 'right' });

        y = 28;

        // Document title
        doc.setTextColor(20, 20, 30);
        doc.setFontSize(FONT_SIZE_H1);
        doc.setFont(FONT_BODY, 'bold');
        doc.text(options.title.toUpperCase(), MARGIN_LEFT, y);
        y += 8;

        // Subtitle / draft watermark
        if (options.subtitle) {
            doc.setFontSize(9);
            doc.setFont(FONT_BODY, 'italic');
            doc.setTextColor(180, 60, 60);
            doc.text(options.subtitle, MARGIN_LEFT, y);
            y += 6;
        }

        // Date line
        doc.setFontSize(8);
        doc.setFont(FONT_BODY, 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, MARGIN_LEFT, y);
        y += 4;

        // Separator line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
        y += 8;

        // ── Body: Parse markdown lines ──────────────────────────────
        const lines = options.content.split('\n');

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();

            // Skip empty lines (but add spacing)
            if (line.trim() === '') {
                y += 3;
                continue;
            }

            // H1
            if (line.startsWith('# ')) {
                checkPageBreak(12);
                doc.setFontSize(FONT_SIZE_H1);
                doc.setFont(FONT_BODY, 'bold');
                doc.setTextColor(20, 20, 30);
                doc.text(line.replace(/^#\s+/, ''), MARGIN_LEFT, y);
                y += 10;
                continue;
            }

            // H2
            if (line.startsWith('## ')) {
                checkPageBreak(10);
                y += 3;
                doc.setFontSize(FONT_SIZE_H2);
                doc.setFont(FONT_BODY, 'bold');
                doc.setTextColor(30, 30, 50);
                doc.text(line.replace(/^##\s+/, ''), MARGIN_LEFT, y);
                y += 8;
                continue;
            }

            // H3
            if (line.startsWith('### ')) {
                checkPageBreak(8);
                y += 2;
                doc.setFontSize(FONT_SIZE_H3);
                doc.setFont(FONT_BODY, 'bold');
                doc.setTextColor(40, 40, 60);
                doc.text(line.replace(/^###\s+/, ''), MARGIN_LEFT, y);
                y += 7;
                continue;
            }

            // Horizontal rule
            if (/^---+$/.test(line.trim())) {
                checkPageBreak(6);
                y += 2;
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.3);
                doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
                y += 5;
                continue;
            }

            // Bullet point
            if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ')) {
                checkPageBreak(6);
                const indent = line.match(/^\s*/)?.[0]?.length ?? 0;
                const bulletIndent = MARGIN_LEFT + Math.min(indent, 4) * 3;
                const text = line.replace(/^\s*[-*]\s+/, '');

                doc.setFontSize(FONT_SIZE_BODY);
                doc.setFont(FONT_BODY, 'normal');
                doc.setTextColor(40, 40, 40);

                // Draw bullet
                doc.setFillColor(40, 40, 40);
                doc.circle(bulletIndent + 1, y - 1.2, 0.6, 'F');

                const wrappedLines = doc.splitTextToSize(ContractPDFService.stripMarkdown(text), CONTENT_WIDTH - (bulletIndent - MARGIN_LEFT) - 6);
                doc.text(wrappedLines, bulletIndent + 4, y);
                y += wrappedLines.length * (FONT_SIZE_BODY * LINE_HEIGHT_MULTIPLIER * 0.352778);
                y += 1;
                continue;
            }

            // Numbered list
            const numberedMatch = line.trimStart().match(/^(\d+)\.\s+(.*)/);
            if (numberedMatch) {
                checkPageBreak(6);
                const num = numberedMatch[1]!;
                const text = numberedMatch[2]!;

                doc.setFontSize(FONT_SIZE_BODY);
                doc.setFont(FONT_BODY, 'bold');
                doc.setTextColor(40, 40, 40);
                doc.text(`${num}.`, MARGIN_LEFT, y);

                doc.setFont(FONT_BODY, 'normal');
                const wrappedLines = doc.splitTextToSize(ContractPDFService.stripMarkdown(text), CONTENT_WIDTH - 8);
                doc.text(wrappedLines, MARGIN_LEFT + 8, y);
                y += wrappedLines.length * (FONT_SIZE_BODY * LINE_HEIGHT_MULTIPLIER * 0.352778);
                y += 1;
                continue;
            }

            // Bold line (entire line bold)
            if (/^\*\*.*\*\*$/.test(line.trim())) {
                checkPageBreak(6);
                doc.setFontSize(FONT_SIZE_BODY);
                doc.setFont(FONT_BODY, 'bold');
                doc.setTextColor(20, 20, 30);
                const text = line.replace(/\*\*/g, '').trim();
                const wrappedLines = doc.splitTextToSize(text, CONTENT_WIDTH);
                doc.text(wrappedLines, MARGIN_LEFT, y);
                y += wrappedLines.length * (FONT_SIZE_BODY * LINE_HEIGHT_MULTIPLIER * 0.352778);
                y += 1;
                continue;
            }

            // Regular paragraph text
            checkPageBreak(6);
            doc.setFontSize(FONT_SIZE_BODY);
            doc.setFont(FONT_BODY, 'normal');
            doc.setTextColor(40, 40, 40);
            const cleanText = ContractPDFService.stripMarkdown(line);
            const wrappedLines = doc.splitTextToSize(cleanText, CONTENT_WIDTH);
            doc.text(wrappedLines, MARGIN_LEFT, y);
            y += wrappedLines.length * (FONT_SIZE_BODY * LINE_HEIGHT_MULTIPLIER * 0.352778);
            y += 1;
        }

        // Final footer
        addFooter(doc, pageNum);

        return doc;
    }

    // ── Utility helpers ─────────────────────────────────────────────────

    /** Strip common markdown formatting (bold, italic, links) */
    private static stripMarkdown(text: string): string {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')    // bold
            .replace(/\*(.*?)\*/g, '$1')          // italic
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')   // links
            .replace(/`(.*?)`/g, '$1');            // inline code
    }

    /** Create a filesystem-friendly slug from a title */
    private static slugify(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);
    }
}

// ── Footer helper (outside class to avoid TS private method overhead) ────
function addFooter(doc: jsPDF, page: number) {
    doc.setFontSize(FONT_SIZE_FOOTER);
    doc.setFont(FONT_BODY, 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text(
        `indiiOS Legal Department — Page ${page} — CONFIDENTIAL`,
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 15,
        { align: 'center' }
    );
    doc.text(
        'This document was generated by AI and should be reviewed by qualified legal counsel.',
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 11,
        { align: 'center' }
    );
}
