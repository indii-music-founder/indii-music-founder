import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractDocumentText } from './textExtractor';

const mockPdfParse = vi.fn();
vi.mock('pdf-parse', () => ({
  default: (...args: any[]) => mockPdfParse(...args),
}));

describe('Document Text Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('extracts plain text documents cleanly', async () => {
    const textBuffer = Buffer.from('Hello world. This is indii Knowledge Base document.', 'utf8');
    const result = await extractDocumentText(textBuffer, 'text/plain', 'original.txt');
    expect(result.text).toBe('Hello world. This is indii Knowledge Base document.');
    expect(result.pageCount).toBe(1);
    expect(result.extractedChars).toBe(51);
  });

  it('extracts markdown documents cleanly', async () => {
    const mdBuffer = Buffer.from('# Title\n\n- Item 1\n- Item 2\n\nContent paragraph.', 'utf8');
    const result = await extractDocumentText(mdBuffer, 'text/markdown', 'original.md');
    expect(result.text).toContain('# Title');
    expect(result.text).toContain('Content paragraph.');
  });

  it('rejects empty text documents', async () => {
    const emptyBuffer = Buffer.from('   \n\n  ', 'utf8');
    await expect(
      extractDocumentText(emptyBuffer, 'text/plain', 'original.txt'),
    ).rejects.toThrow('Zero text extracted');
  });

  it('rejects encrypted PDFs', async () => {
    const encryptedPdfHeader = '%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj\nstream\nendstream';
    const buffer = Buffer.from(encryptedPdfHeader, 'binary');
    await expect(
      extractDocumentText(buffer, 'application/pdf', 'original.pdf'),
    ).rejects.toThrow('Encrypted or password-protected PDFs are not supported.');
  });

  it('rejects image-only / scanned PDFs with zero text', async () => {
    const imageOnlyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\nstream\nendstream';
    const buffer = Buffer.from(imageOnlyPdf, 'binary');
    mockPdfParse.mockResolvedValue({ text: '    ', numpages: 1 });
    await expect(
      extractDocumentText(buffer, 'application/pdf', 'original.pdf'),
    ).rejects.toThrow('Zero text extracted from PDF');
  });

  it('extracts text-based PDF streams', async () => {
    const pdfContent =
      '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\nstream\nBT (Welcome to indii RAG Search) Tj ET\nendstream';
    const buffer = Buffer.from(pdfContent, 'binary');
    mockPdfParse.mockResolvedValue({ text: 'Welcome to indii RAG Search', numpages: 1 });
    const result = await extractDocumentText(buffer, 'application/pdf', 'original.pdf');
    expect(result.text).toBe('Welcome to indii RAG Search');
  });
});
