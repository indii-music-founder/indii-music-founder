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

export async function extractPdfContractText(filePath: string): Promise<PdfContractExtraction> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileData = fs.readFileSync(filePath);
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(fileData),
        standardFontDataUrl,
    });
    const pdfDocument = await loadingTask.promise;
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
