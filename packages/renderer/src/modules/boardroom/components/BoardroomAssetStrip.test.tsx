import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: unknown) => unknown) => selector({
        generatedHistory: mockStore.generatedHistory,
        openImageInStudio: mockStore.openImageInStudio,
    }),
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
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(3);
        expect(buttons[0]).toHaveAttribute('aria-label', expect.stringContaining('Album cover concept'));
    });

    it('opens images in the Studio editor when clicked', () => {
        render(<BoardroomAssetStrip />);
        fireEvent.click(screen.getByRole('button', { name: /Album cover concept/i }));
        expect(mockStore.openImageInStudio).toHaveBeenCalledWith(expect.objectContaining({
            imageId: 'img-1',
            sourceUrl: 'https://firebasestorage.example.com/img1.png',
            prompt: 'Album cover concept',
        }));
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
