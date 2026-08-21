import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfjsRequire = createRequire(__filename);
const pdfjsRoot = path.dirname(pdfjsRequire.resolve('pdfjs-dist/package.json'));
const standardFontDataUrl = `${path.join(pdfjsRoot, 'standard_fonts')}${path.sep}`;

export interface PdfPageText {
    pageNumber: number;
    text: string;
}

export interface PdfContractExtraction {
    filePath: string;
    pageCount: number;
    text: string;
    pages: PdfPageText[];
    hasSelectableText: boolean;
}

/** Default caps for local PDF reads — a crafted/huge file must not be able
 *  to exhaust memory (readFileSync loads the whole file) or spin the page
 *  loop. Options allow tests to exercise the caps with tiny values. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_PDF_PAGES = 500;

export interface PdfExtractionOptions {
    maxBytes?: number;
    maxPages?: number;
}

export async function extractPdfContractText(
    filePath: string,
    options: PdfExtractionOptions = {},
): Promise<PdfContractExtraction> {
    const maxBytes = options.maxBytes ?? MAX_PDF_BYTES;
    const maxPages = options.maxPages ?? MAX_PDF_PAGES;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const { size } = fs.statSync(filePath);
    if (size > maxBytes) {
        throw new Error(
            `PDF is ${size} bytes — exceeds the ${maxBytes} byte extraction cap. Refusing to read it into memory.`
        );
    }

    const fileData = fs.readFileSync(filePath);
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(fileData),
        standardFontDataUrl,
    });
    const pdfDocument = await loadingTask.promise;
    if (pdfDocument.numPages > maxPages) {
        const pageCount = pdfDocument.numPages;
        await pdfDocument.destroy().catch(() => undefined);
        throw new Error(
            `PDF has ${pageCount} pages — exceeds the ${maxPages} page extraction cap.`
        );
    }
    const pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        pages.push({ pageNumber, text });
    }

    const text = pages
        .map(({ pageNumber, text: pageText }) => `--- Page ${pageNumber} ---\n${pageText}`)
        .join('\n\n')
        .trim();

    return {
        filePath,
        pageCount: pdfDocument.numPages,
        text,
        pages,
        hasSelectableText: text.length > 0,
    };
}
