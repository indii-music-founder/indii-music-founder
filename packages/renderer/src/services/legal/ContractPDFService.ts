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
        window.open(url, '_blank', 'noopener,noreferrer');
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
            creator: 'indii Legal Department',
            author: 'indii',
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
        doc.text('indii LEGAL DEPARTMENT', MARGIN_LEFT, 12);
        doc.setFontSize(7);
        doc.setFont(FONT_BODY, 'normal');
        doc.text('Autonomous Contract Analysis', PAGE_WIDTH - MARGIN_RIGHT, 12, { align: 'right' });

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

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i]!;
            const line = rawLine.trimEnd();

            // Skip empty lines (but add spacing)
            if (line.trim() === '') {
                y += 3;
                continue;
            }

            // Markdown Table block
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                const tableLines: string[] = [];
                while (i < lines.length && lines[i]!.trim().startsWith('|') && lines[i]!.trim().endsWith('|')) {
                    tableLines.push(lines[i]!.trim());
                    i++;
                }
                i--; // counter-balance loop increment

                ContractPDFService.renderTable(
                    doc,
                    tableLines,
                    checkPageBreak,
                    () => y,
                    (newY) => { y = newY; }
                );
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

    // ── Table Renderer ──────────────────────────────────────────────────
    private static renderTable(
        doc: jsPDF,
        tableLines: string[],
        checkPageBreak: (neededHeight: number) => void,
        getY: () => number,
        setY: (newY: number) => void
    ): void {
        if (tableLines.length === 0) return;

        const parseRow = (rowLine: string): string[] => {
            const trimmed = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '');
            return trimmed.split('|').map((c) => ContractPDFService.stripMarkdown(c.trim()));
        };

        const isSeparator = (rowLine: string): boolean => {
            const cells = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
            return cells.every((c) => /^[\s\-:]+$/.test(c.trim()));
        };

        const rawRows = tableLines.filter((l) => l.trim().length > 0);
        let headerRow: string[] = [];
        const dataRows: string[][] = [];

        if (rawRows.length > 1 && isSeparator(rawRows[1]!)) {
            headerRow = parseRow(rawRows[0]!);
            for (let r = 2; r < rawRows.length; r++) {
                if (!isSeparator(rawRows[r]!)) {
                    dataRows.push(parseRow(rawRows[r]!));
                }
            }
        } else {
            headerRow = parseRow(rawRows[0]!);
            for (let r = 1; r < rawRows.length; r++) {
                if (!isSeparator(rawRows[r]!)) {
                    dataRows.push(parseRow(rawRows[r]!));
                }
            }
        }

        const numCols = Math.max(headerRow.length, ...dataRows.map((r) => r.length));
        if (numCols === 0) return;

        while (headerRow.length < numCols) headerRow.push('');
        dataRows.forEach((r) => {
            while (r.length < numCols) r.push('');
        });

        // Compute proportional column widths based on content size
        const colWeights = headerRow.map((h, colIdx) => {
            let maxLen = h.length;
            for (const row of dataRows) {
                const cell = row[colIdx] ?? '';
                if (cell.length > maxLen) {
                    maxLen = Math.min(cell.length, 30);
                }
            }
            return Math.max(maxLen, 6);
        });

        const totalWeight = colWeights.reduce((acc, curr) => acc + curr, 0);
        const colWidths = colWeights.map((w) => (w / totalWeight) * CONTENT_WIDTH);

        const PADDING_X = 2;
        const PADDING_Y = 1.8;
        const LINE_HEIGHT_ROW = 3.6;

        const measureRow = (cells: string[], fontSize: number, isBold: boolean) => {
            doc.setFontSize(fontSize);
            doc.setFont(FONT_BODY, isBold ? 'bold' : 'normal');
            const cellWrappedLines: string[][] = [];
            let maxLines = 1;

            for (let c = 0; c < numCols; c++) {
                const text = cells[c] ?? '';
                const maxW = Math.max(colWidths[c]! - PADDING_X * 2, 4);
                const wrapped = doc.splitTextToSize(text, maxW);
                cellWrappedLines.push(wrapped);
                if (wrapped.length > maxLines) {
                    maxLines = wrapped.length;
                }
            }

            const rowHeight = maxLines * LINE_HEIGHT_ROW + PADDING_Y * 2;
            return { rowHeight, cellWrappedLines };
        };

        let currentY = getY();

        // 1. Render Header
        const headerMeasurement = measureRow(headerRow, 8.5, true);
        checkPageBreak(headerMeasurement.rowHeight + 4);
        currentY = getY();

        // Header Background
        doc.setFillColor(240, 243, 248);
        doc.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, headerMeasurement.rowHeight, 'F');

        // Header Border
        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_LEFT, currentY + headerMeasurement.rowHeight, MARGIN_LEFT + CONTENT_WIDTH, currentY + headerMeasurement.rowHeight);

        // Header Text
        doc.setFontSize(8.5);
        doc.setFont(FONT_BODY, 'bold');
        doc.setTextColor(20, 25, 40);

        let colX = MARGIN_LEFT;
        for (let c = 0; c < numCols; c++) {
            const lines = headerMeasurement.cellWrappedLines[c]!;
            lines.forEach((lineText, lIdx) => {
                doc.text(lineText, colX + PADDING_X, currentY + PADDING_Y + 2.8 + lIdx * LINE_HEIGHT_ROW);
            });
            colX += colWidths[c]!;
        }

        currentY += headerMeasurement.rowHeight;
        setY(currentY);

        // 2. Render Data Rows
        dataRows.forEach((row, rIdx) => {
            const rowMeasurement = measureRow(row, 8, false);
            checkPageBreak(rowMeasurement.rowHeight);
            currentY = getY();

            // Zebra striping
            if (rIdx % 2 === 1) {
                doc.setFillColor(248, 249, 252);
                doc.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, rowMeasurement.rowHeight, 'F');
            }

            // Cell horizontal border
            doc.setDrawColor(228, 231, 238);
            doc.setLineWidth(0.15);
            doc.line(MARGIN_LEFT, currentY + rowMeasurement.rowHeight, MARGIN_LEFT + CONTENT_WIDTH, currentY + rowMeasurement.rowHeight);

            // Row Text
            doc.setFontSize(8);
            doc.setFont(FONT_BODY, 'normal');
            doc.setTextColor(40, 45, 55);

            let rowColX = MARGIN_LEFT;
            for (let c = 0; c < numCols; c++) {
                const lines = rowMeasurement.cellWrappedLines[c]!;
                lines.forEach((lineText, lIdx) => {
                    doc.text(lineText, rowColX + PADDING_X, currentY + PADDING_Y + 2.6 + lIdx * LINE_HEIGHT_ROW);
                });
                rowColX += colWidths[c]!;
            }

            currentY += rowMeasurement.rowHeight;
            setY(currentY);
        });

        // Bottom border line for entire table
        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_LEFT, currentY, MARGIN_LEFT + CONTENT_WIDTH, currentY);

        currentY += 5;
        setY(currentY);
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
        `indii Legal Department — Page ${page} — CONFIDENTIAL`,
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 15,
        { align: 'center' }
    );
    doc.text(
        'This document was generated by autonomous systems and should be reviewed by qualified legal counsel.',
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 11,
        { align: 'center' }
    );
}
