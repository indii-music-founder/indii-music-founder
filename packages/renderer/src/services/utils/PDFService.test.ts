import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFService } from './PDFService';

const { getPage, destroy, getDocument } = vi.hoisted(() => ({
    getPage: vi.fn(),
    destroy: vi.fn(),
    getDocument: vi.fn(),
}));
const pdfDocument = { numPages: 1, getPage, destroy };
getPage.mockResolvedValue({ getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Extracted local PDF text' }] }) });
destroy.mockResolvedValue(undefined);
getDocument.mockImplementation(() => ({ promise: Promise.resolve(pdfDocument) }));

vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument,
}));

describe('PDFService local extraction', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        getDocument.mockClear();
        getPage.mockClear();
        destroy.mockClear();
    });

    it('returns extracted text with DETECTED provenance and does not call an external service', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const file = new File(['local pdf bytes'], 'press-kit.pdf', { type: 'application/pdf' });
        const report = await PDFService.extractTextWithProvenance(file);

        expect(report.text).toBe('--- Page 1 ---\nExtracted local PDF text');
        expect(report.pageCount).toBe(1);
        expect(report.provenance.state).toBe('DETECTED');
        expect(report.provenance.note).toMatch(/later transmission is separate/i);
        expect(report.mode).toBe('LOCAL_EXTRACTION');
        expect(report.persisted).toBe(false);
        expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.any(ArrayBuffer),
            useWorkerFetch: false,
            isEvalSupported: false,
        }));
        expect(destroy).toHaveBeenCalledOnce();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('preserves the legacy string-returning extraction API', async () => {
        const file = new File(['local pdf bytes'], 'press-kit.pdf', { type: 'application/pdf' });
        await expect(PDFService.extractText(file)).resolves.toBe('--- Page 1 ---\nExtracted local PDF text');
    });

    it('rejects path strings rather than interpreting them as local bytes', async () => {
        await expect(PDFService.extractTextWithProvenance('/private/press-kit.pdf' as unknown as File))
            .rejects.toThrow(/in-memory file/i);
        expect(getDocument).not.toHaveBeenCalled();
    });
});
