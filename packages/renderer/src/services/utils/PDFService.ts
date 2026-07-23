import { logger } from '@/utils/logger';

interface PDFTextItem {
    str: string;
    dir?: string;
    width?: number;
    height?: number;
    transform?: number[];
    fontName?: string;
    hasEOL?: boolean;
}

export class PDFService {
    /**
     * Extracts full text from a PDF file (pdfjs-dist dynamically loaded on first use).
     */
    static async extractText(file: File): Promise<string> {
        try {
            const pdfjsLib = await import('pdfjs-dist');
            if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    'pdfjs-dist/build/pdf.worker.min.mjs',
                    import.meta.url
                ).toString();
            }

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDocument = await loadingTask.promise;

            let fullText = '';

            for (let i = 1; i <= pdfDocument.numPages; i++) {
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = (textContent.items as PDFTextItem[])
                    .map((item) => item.str)
                    .join(' ');

                fullText += `--- Page ${i} ---\n${pageText}\n\n`;
            }

            return fullText.trim();
        } catch (error: unknown) {
            logger.error('PDF Extraction Error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }
}
