import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnboarding } from './useOnboarding';

const { mockExtractText, mockRunConversation } = vi.hoisted(() => ({
    mockExtractText: vi.fn(),
    mockRunConversation: vi.fn(),
}));

vi.mock('@/services/onboarding/onboardingService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/onboarding/onboardingService')>();
    return { ...actual, runOnboardingConversation: mockRunConversation };
});

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

/**
 * ISSUE-957: a failed send must not discard the typed prompt or selected
 * attachments — the composer is restored so "send again" reproduces the
 * exact same turn.
 */
describe('useOnboarding handleSend failure recovery (ISSUE-957)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('restores input text and attachments when the conversation call fails', async () => {
        mockRunConversation.mockRejectedValue(new Error('ONBOARDING_TIMEOUT'));
        const { result } = renderHook(() => useOnboarding());

        // Attach a file, type a narrative
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        await act(async () => {
            await result.current.handleFileSelect({ target: { files: [file], value: '' } } as any);
        });
        await waitFor(() => expect(result.current.files).toHaveLength(1));
        act(() => result.current.setInput('My long artist story'));

        await act(async () => {
            await result.current.handleSend();
        });

        // Composer fully restored — text and attachment both intact.
        expect(result.current.input).toBe('My long artist story');
        expect(result.current.files).toHaveLength(1);
        expect(result.current.files[0]!.file.name).toBe('notes.txt');
        // The unanswered user turn was withdrawn; the thread ends with the error message.
        const lastMsg = result.current.history[result.current.history.length - 1]!;
        expect(lastMsg.role).toBe('model');
        expect(result.current.history.some(m => m.role === 'user' && m.parts?.[0]?.text === 'My long artist story')).toBe(false);
    });

    it('clears the composer only on success', async () => {
        mockRunConversation.mockResolvedValue({ text: 'Great, tell me more!', functionCalls: [] });
        const { result } = renderHook(() => useOnboarding());

        act(() => result.current.setInput('My long artist story'));
        await act(async () => {
            await result.current.handleSend();
        });

        expect(result.current.input).toBe('');
        expect(result.current.files).toHaveLength(0);
        expect(result.current.history.some(m => m.role === 'user' && m.parts?.[0]?.text === 'My long artist story')).toBe(true);
    });
});
