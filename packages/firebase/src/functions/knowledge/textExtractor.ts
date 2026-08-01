import { HttpsError } from 'firebase-functions/v2/https';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  text: string;
  pages: ExtractedPage[];
  pageCount: number;
  extractedChars: number;
}

/**
 * Text Extractor for Knowledge Base Documents.
 * Supports .txt, .md, and text-based .pdf files.
 * Rejects encrypted PDFs, scanned/image-only PDFs (zero text), and unsupported formats.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    throw new HttpsError('invalid-argument', 'Document buffer is empty.');
  }

  const isText = mimeType === 'text/plain' || fileName.endsWith('.txt');
  const isMarkdown = mimeType === 'text/markdown' || fileName.endsWith('.md');
  const isPdf = mimeType === 'application/pdf' || fileName.endsWith('.pdf');

  if (isText || isMarkdown) {
    const rawText = buffer.toString('utf8').trim();
    if (!rawText) {
      throw new HttpsError('failed-precondition', 'Zero text extracted from text document.');
    }
    return {
      text: rawText,
      pages: [{ pageNumber: 1, text: rawText }],
      pageCount: 1,
      extractedChars: rawText.length,
    };
  }

  if (isPdf) {
    return extractPdfText(buffer);
  }

  throw new HttpsError('invalid-argument', `Unsupported document MIME type: ${mimeType}`);
}

/**
 * Parse text-based PDF buffers using pdf-parse.
 * Rejects encrypted PDFs and scanned/image-only PDFs where zero text could be extracted.
 */
async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  const header = buffer.subarray(0, 1024).toString('binary');
  if (!header.startsWith('%PDF-')) {
    throw new HttpsError('invalid-argument', 'File is not a valid PDF document.');
  }

  // Quick heuristic check for encryption, pdf-parse throws on encrypted too
  const fullContent = buffer.toString('binary');
  if (/\/Encrypt\s+/i.test(fullContent)) {
    throw new HttpsError(
      'failed-precondition',
      'Encrypted or password-protected PDFs are not supported.',
    );
  }

  try {
    const data = await pdfParse(buffer, {
      max: 0, // no page limit
    });
    
    if (!data || !data.text || data.text.trim().length === 0) {
      throw new Error('Zero text extracted');
    }

    const normalized = data.text.replace(/\s+/g, ' ').trim();
    if (normalized.length < 10) {
      throw new Error('Minimal text extracted');
    }

    return {
      text: normalized,
      pages: [{ pageNumber: 1, text: normalized }], // pdf-parse flattens pages by default
      pageCount: data.numpages || 1,
      extractedChars: normalized.length,
    };
  } catch (err: any) {
    throw new HttpsError(
      'failed-precondition',
      'Zero text extracted from PDF or file is encrypted. Scanned or image-only PDFs require pre-processed text.',
    );
  }
}

