import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnboarding } from './useOnboarding';

const { mockExtractText } = vi.hoisted(() => ({
    mockExtractText: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: { id: 'user-1' },
        setUserProfile: vi.fn(),
        setModule: vi.fn(),
        addActiveAgent: vi.fn(),
        removeActiveAgent: vi.fn(),
    }),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/services/onboarding/onboardingAnalytics', () => ({
    onboardingAnalytics: {
        start: vi.fn(),
        fieldCompleted: vi.fn(),
        completed: vi.fn(),
        skipped: vi.fn(),
    },
}));

vi.mock('@/services/founders/founderFunnel', () => ({
    flushFounderFunnelQueue: vi.fn(),
    trackFounderFunnelEvent: vi.fn(),
}));

vi.mock('@/services/utils/PDFService', () => ({
    PDFService: { extractText: mockExtractText },
}));

/**
 * ISSUE-955: audio/PDF attachments previously became fake metadata strings
 * ("[Audio File: ...]", "[PDF Document: ...]") with no real content ever
 * read — the model could never hear the audio or read the PDF.
 */
describe('useOnboarding processFiles (ISSUE-955)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('extracts real PDF text via PDFService instead of a size-only placeholder', async () => {
        mockExtractText.mockResolvedValue('--- Page 1 ---\nOur new single drops Friday.');
        const { result } = renderHook(() => useOnboarding());

        const pdfFile = new File(['pdf-bytes'], 'press-kit.pdf', { type: 'application/pdf' });
        await act(async () => {
            await result.current.handleFileSelect({ target: { files: [pdfFile] } } as any);
        });

        await waitFor(() => expect(result.current.files).toHaveLength(1));
        expect(result.current.files[0]!.content).toContain('Our new single drops Friday.');
        expect(result.current.files[0]!.content).not.toMatch(/^\[PDF Document:.*Size:/);
    });

    it('reports an honest error placeholder when PDF extraction fails (encrypted/corrupt)', async () => {
        mockExtractText.mockRejectedValue(new Error('Failed to extract text from PDF'));
        const { result } = renderHook(() => useOnboarding());

        const pdfFile = new File(['pdf-bytes'], 'encrypted.pdf', { type: 'application/pdf' });
        await act(async () => {
            await result.current.handleFileSelect({ target: { files: [pdfFile] } } as any);
        });

        await waitFor(() => expect(result.current.files).toHaveLength(1));
        expect(result.current.files[0]!.content).toContain('could not be read');
    });

    it('attaches audio bytes (base64) instead of a metadata-only placeholder', async () => {
        const { result } = renderHook(() => useOnboarding());

        const audioFile = new File(['fake audio bytes'], 'demo.mp3', { type: 'audio/mpeg' });
        await act(async () => {
            await result.current.handleFileSelect({ target: { files: [audioFile] } } as any);
        });

        await waitFor(() => expect(result.current.files).toHaveLength(1));
        expect(result.current.files[0]!.base64).toBeTruthy();
        expect(result.current.files[0]!.content).toBeUndefined();
    });

    it('rejects an oversized audio file with a clear placeholder instead of silently failing to attach it', async () => {
        const { result } = renderHook(() => useOnboarding());

        const oversized = new File(['x'], 'huge-master.wav', { type: 'audio/wav' });
        Object.defineProperty(oversized, 'size', { value: 20 * 1024 * 1024 });

        await act(async () => {
            await result.current.handleFileSelect({ target: { files: [oversized] } } as any);
        });

        await waitFor(() => expect(result.current.files).toHaveLength(1));
        expect(result.current.files[0]!.base64).toBeUndefined();
        expect(result.current.files[0]!.content).toContain('over the');
        expect(result.current.files[0]!.content).toContain('limit');
    });
});
