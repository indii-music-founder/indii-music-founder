import { logger } from '@/utils/logger';
import type { Provenance } from '@shared/schemas/musicEntity';

interface PDFTextItem {
    str: string;
    dir?: string;
    width?: number;
    height?: number;
    transform?: number[];
    fontName?: string;
    hasEOL?: boolean;
}

export interface LocalPDFTextExtractionReport {
    filename: string;
    text: string;
    pageCount: number;
    provenance: Provenance;
    mode: 'LOCAL_EXTRACTION';
    persisted: false;
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error || new Error('Unable to read the selected PDF.'));
        reader.readAsArrayBuffer(file);
    });
}

export class PDFService {
    /**
     * Extracts full text from a PDF file (pdfjs-dist dynamically loaded on first use).
     */
    static async extractText(file: File): Promise<string> {
        return (await PDFService.extractTextWithProvenance(file)).text;
    }

    /**
     * Extracts text from bytes supplied by the user. This PDF parse runs
     * locally; a caller may still transmit the returned text in a later,
    * explicitly connected workflow.
     */
    static async extractTextWithProvenance(file: File): Promise<LocalPDFTextExtractionReport> {
        if (!file || typeof file !== 'object' || typeof file.size !== 'number') {
            throw new Error('Local PDF extraction requires an in-memory file.');
        }

        try {
            const pdfjsLib = await import('pdfjs-dist');
            if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    'pdfjs-dist/build/pdf.worker.min.mjs',
                    import.meta.url
                ).toString();
            }

            const arrayBuffer = await readFileBytes(file);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false });
            const pdfDocument = await loadingTask.promise;

            let fullText = '';

            try {
                for (let i = 1; i <= pdfDocument.numPages; i++) {
                    const page = await pdfDocument.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = (textContent.items as PDFTextItem[])
                        .map((item) => item.str)
                        .join(' ');

                    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
                }
            } finally {
                await pdfDocument.destroy();
            }

            const text = fullText.trim();
            return {
                filename: file.name,
                text,
                pageCount: pdfDocument.numPages,
                provenance: {
                    state: 'DETECTED',
                    sourceType: 'SYSTEM',
                    sourceId: 'local-pdf-text-extraction',
                    evidence: [{
                        id: 'local-pdf-extraction-observation',
                        type: 'OTHER',
                        description: `Text was extracted locally from the user-selected PDF (${pdfDocument.numPages} page(s)); document claims were not independently verified.`,
                    }],
                    observedAt: new Date().toISOString(),
                    note: 'The PDF parser receives local file bytes and calls no AI service; its app-shipped worker may load from the application origin. If submitted to a connected AI workflow, that later transmission is separate.',
                },
                mode: 'LOCAL_EXTRACTION',
                persisted: false,
            };
        } catch (error: unknown) {
            logger.error('PDF Extraction Error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }
}
