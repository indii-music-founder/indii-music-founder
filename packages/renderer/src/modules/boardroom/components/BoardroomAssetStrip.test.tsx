import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoardroomAssetStrip } from './BoardroomAssetStrip';

const mockStore = vi.hoisted(() => ({
    openImageInStudio: vi.fn(),
    generatedHistory: [] as Array<{
        id: string;
        type: 'image' | 'video' | 'music' | 'text';
        url: string;
        prompt: string;
        timestamp: number;
        projectId: string;
    }>,
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const mockDownloadAsset = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: unknown) => unknown) => selector({
        generatedHistory: mockStore.generatedHistory,
        openImageInStudio: mockStore.openImageInStudio,
    }),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

vi.mock('@/utils/download', () => ({
    downloadAsset: mockDownloadAsset,
}));

describe('BoardroomAssetStrip (ISSUE-1361 in-page workspace)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore.generatedHistory = [
            {
                id: 'img-1',
                type: 'image',
                url: 'https://firebasestorage.example.com/img1.png',
                prompt: 'Album cover concept',
                timestamp: 3,
                projectId: 'p1',
            },
            {
                id: 'vid-1',
                type: 'video',
                url: 'https://firebasestorage.example.com/vid1.mp4',
                prompt: 'Promo clip',
                timestamp: 2,
                projectId: 'p1',
            },
            {
                id: 'text-1',
                type: 'text',
                url: 'https://firebasestorage.example.com/doc1.pdf',
                prompt: 'EPK draft',
                timestamp: 1,
                projectId: 'p1',
            },
        ];
    });

    it('renders nothing when there are no generated assets', () => {
        mockStore.generatedHistory = [];
        const { container } = render(<BoardroomAssetStrip />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a strip of recent generated assets with the latest first', () => {
        render(<BoardroomAssetStrip />);
        expect(screen.getByTestId('boardroom-asset-strip')).toBeDefined();
        // 3 preview tiles (role=button) + 3 hover Export buttons.
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(6);
        expect(buttons[0]).toHaveAttribute('aria-label', expect.stringContaining('Album cover concept'));
    });

    it('does not send to Studio on strip click — opens the enlarged preview instead', () => {
        render(<BoardroomAssetStrip />);
        fireEvent.click(screen.getByRole('button', { name: /^Preview Album cover concept/i }));
        // The handoff must NOT happen on strip click (silent action was the bug).
        expect(mockStore.openImageInStudio).not.toHaveBeenCalled();
        expect(screen.getByTestId('boardroom-asset-preview')).toBeDefined();
    });

    it('opens the enlarged preview, then sends to Studio only on explicit action with a toast', async () => {
        render(<BoardroomAssetStrip />);
        fireEvent.click(screen.getByRole('button', { name: /^Preview Album cover concept/i }));

        const openInStudio = screen.getByTestId('boardroom-asset-open-in-studio');
        fireEvent.click(openInStudio);

        expect(mockStore.openImageInStudio).toHaveBeenCalledWith(expect.objectContaining({
            imageId: 'img-1',
            sourceUrl: 'https://firebasestorage.example.com/img1.png',
            prompt: 'Album cover concept',
        }));
        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('sent to Studio'));
        });
        // Preview closes after handoff.
        expect(screen.queryByTestId('boardroom-asset-preview')).toBeNull();
    });

    it('closes the preview without handing off when dismissed', () => {
        render(<BoardroomAssetStrip />);
        fireEvent.click(screen.getByRole('button', { name: /^Preview Album cover concept/i }));
        fireEvent.click(screen.getByTestId('boardroom-asset-preview-close'));
        expect(screen.queryByTestId('boardroom-asset-preview')).toBeNull();
        expect(mockStore.openImageInStudio).not.toHaveBeenCalled();
    });

    it('exports (downloads) an asset from the enlarged preview (ISSUE-1371)', async () => {
        render(<BoardroomAssetStrip />);
        fireEvent.click(screen.getByRole('button', { name: /^Preview Album cover concept/i }));

        fireEvent.click(screen.getByTestId('boardroom-asset-export'));

        await waitFor(() => {
            expect(mockDownloadAsset).toHaveBeenCalledWith(
                'https://firebasestorage.example.com/img1.png',
                'image-export-img-1.png'
            );
            expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('exported'));
        });
        // Export is not a handoff — the preview stays open.
        expect(screen.getByTestId('boardroom-asset-preview')).toBeDefined();
        expect(mockStore.openImageInStudio).not.toHaveBeenCalled();
    });

    it('exports directly from the tile hover action without opening the preview (ISSUE-1371)', async () => {
        render(<BoardroomAssetStrip />);

        fireEvent.click(screen.getByTestId('boardroom-asset-export-img-1'));

        await waitFor(() => {
            expect(mockDownloadAsset).toHaveBeenCalledWith(
                'https://firebasestorage.example.com/img1.png',
                'image-export-img-1.png'
            );
        });
        expect(screen.queryByTestId('boardroom-asset-preview')).toBeNull();
        expect(mockStore.openImageInStudio).not.toHaveBeenCalled();
    });

    it('does not render data-URI blobs (ephemeral) in the strip', () => {
        mockStore.generatedHistory = [
            {
                id: 'blob-1',
                type: 'image',
                url: 'data:image/png;base64,AAAA',
                prompt: 'Transient canvas',
                timestamp: 4,
                projectId: 'p1',
            },
            ...mockStore.generatedHistory,
        ];
        render(<BoardroomAssetStrip />);
        expect(screen.queryByRole('button', { name: /Transient canvas/i })).toBeNull();
    });
});
