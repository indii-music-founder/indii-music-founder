import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ShowroomUI from './ShowroomUI';
import { useToast } from '@/core/context/ToastContext';

// ISSUE-959 regression: showroom intake must reject unsupported types, read
// failures, and bytes that do not decode as an image — before generation.

vi.mock('@/core/context/ToastContext', () => ({ useToast: vi.fn() }));

const mockSetShowroomState = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: Record<string, unknown>) => unknown) => selector({
        showroomState: {
            productAsset: null,
            productType: 'T-Shirt',
            sceneDescription: '',
            placementHint: '',
            isGeneratingMockup: false,
            isGeneratingVideo: false,
            mockupResult: null,
            videoResult: null,
        },
        setShowroomState: mockSetShowroomState,
        currentProjectId: 'p1',
        addToHistory: vi.fn(),
        pinToClipboard: vi.fn(),
        sendToStage: vi.fn(),
    }),
}));

vi.mock('@/components/kokonutui/file-upload', () => ({
    default: ({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) => (
        <button
            data-testid="mock-file-upload"
            onClick={() => onFilesSelected([(globalThis as Record<string, unknown>).__showroomTestFile as File])}
        >
            upload
        </button>
    ),
}));

vi.mock('@/services/creative/ShowroomService', () => ({
    showroomService: { runShowroomMockup: vi.fn(), runShowroomVideo: vi.fn() },
}));

class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 800;
    naturalHeight = 600;
    set src(_v: string) {
        const shouldDecode = (globalThis as Record<string, unknown>).__showroomImageDecodes !== false;
        queueMicrotask(() => (shouldDecode ? this.onload?.() : this.onerror?.()));
    }
}

describe('ShowroomUI intake (ISSUE-959)', () => {
    const mockToastError = vi.fn();
    const RealImage = globalThis.Image;

    beforeEach(() => {
        vi.clearAllMocks();
        (useToast as unknown as import('vitest').Mock).mockReturnValue({
            success: vi.fn(), info: vi.fn(), error: mockToastError,
        });
        globalThis.Image = MockImage as unknown as typeof Image;
        (globalThis as Record<string, unknown>).__showroomImageDecodes = true;
    });

    afterEach(() => {
        globalThis.Image = RealImage;
    });

    const selectFile = (file: File) => {
        (globalThis as Record<string, unknown>).__showroomTestFile = file;
        fireEvent.click(screen.getByTestId('mock-file-upload'));
    };

    it('accepts a decodable PNG and stores the asset', async () => {
        render(<ShowroomUI />);
        selectFile(new File([new Uint8Array(8)], 'logo.png', { type: 'image/png' }));

        await waitFor(() => {
            expect(mockSetShowroomState).toHaveBeenCalledWith(
                expect.objectContaining({ productAsset: expect.objectContaining({ type: 'image', origin: 'uploaded' }) })
            );
        });
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('rejects an unsupported type with a specific error and stores nothing', async () => {
        render(<ShowroomUI />);
        selectFile(new File([new Uint8Array(8)], 'doc.pdf', { type: 'application/pdf' }));

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('doc.pdf'));
        });
        expect(mockSetShowroomState).not.toHaveBeenCalled();
    });

    it('rejects a file whose bytes do not decode as an image', async () => {
        (globalThis as Record<string, unknown>).__showroomImageDecodes = false;
        render(<ShowroomUI />);
        selectFile(new File([new Uint8Array(8)], 'fake.png', { type: 'image/png' }));

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('not a valid image'));
        });
        expect(mockSetShowroomState).not.toHaveBeenCalled();
    });
});
