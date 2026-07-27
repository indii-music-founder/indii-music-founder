import { HttpsError } from 'firebase-functions/v2/https';

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
 * Parse text-based PDF buffers.
 * Detects encrypted PDFs and scanned/image-only PDFs.
 */
function extractPdfText(buffer: Buffer): ExtractionResult {
  const header = buffer.subarray(0, 1024).toString('binary');
  if (!header.startsWith('%PDF-')) {
    throw new HttpsError('invalid-argument', 'File is not a valid PDF document.');
  }

  // Check for PDF encryption dictionary (/Encrypt)
  const fullContent = buffer.toString('binary');
  if (/\/Encrypt\s+/i.test(fullContent)) {
    throw new HttpsError(
      'failed-precondition',
      'Encrypted or password-protected PDFs are not supported.',
    );
  }

  const pages: ExtractedPage[] = [];
  let pageNumber = 1;

  // Extract text chunks from PDF streams (text blocks between BT and ET operators, TJ/Tj arrays)
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/gi;
  let match: RegExpExecArray | null;

  let fullExtractedText = '';

  while ((match = streamRegex.exec(fullContent)) !== null) {
    const streamContent = match[1] || '';
    const textMatches = extractTextFromPdfStream(streamContent);
    if (textMatches) {
      pages.push({ pageNumber, text: textMatches });
      fullExtractedText += (fullExtractedText ? '\n\n' : '') + textMatches;
      pageNumber++;
    }
  }

  // Fallback: If stream parsing found minimal text, attempt raw string extraction
  if (!fullExtractedText || fullExtractedText.trim().length === 0) {
    const rawMatches: string[] = [];
    const textOpRegex = /\(([^)]+)\)\s*T[jJ]/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textOpRegex.exec(fullContent)) !== null) {
      if (textMatch[1]) {
        const cleaned = textMatch[1].replace(/\\([0-7]{3}|[()\\nrtbf])/g, ' ').trim();
        if (cleaned.length > 0) rawMatches.push(cleaned);
      }
    }
    fullExtractedText = rawMatches.join(' ').trim();
    if (fullExtractedText) {
      pages.push({ pageNumber: 1, text: fullExtractedText });
    }
  }

  const normalized = fullExtractedText.replace(/\s+/g, ' ').trim();

  // Reject scanned/image-only PDFs where zero text could be extracted
  if (!normalized || normalized.length < 10) {
    throw new HttpsError(
      'failed-precondition',
      'Zero text extracted from PDF. Scanned or image-only PDFs require pre-processed text.',
    );
  }

  return {
    text: normalized,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: normalized }],
    pageCount: pages.length || 1,
    extractedChars: normalized.length,
  };
}

/**
 * Decode text operators inside a PDF content stream
 */
function extractTextFromPdfStream(stream: string): string {
  const extracted: string[] = [];
  const textBlockRegex = /BT[\s\S]*?ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = textBlockRegex.exec(stream)) !== null) {
    const block = blockMatch[0];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      if (tjMatch[1]) {
        extracted.push(tjMatch[1]);
      }
    }
    const arrayTjRegex = /\[\s*\(([^)]+)\)[\s\S]*?\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = arrayTjRegex.exec(block)) !== null) {
      if (arrayMatch[1]) {
        extracted.push(arrayMatch[1]);
      }
    }
  }

  return extracted
    .join(' ')
    .replace(/\\([0-7]{3}|[()\\nrtbf])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
