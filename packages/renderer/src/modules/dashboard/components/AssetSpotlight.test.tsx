import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetSpotlight from './AssetSpotlight';

const mockGeneratedHistory = [
    {
        id: 'vid-1',
        type: 'video',
        url: 'https://storage.googleapis.com/test/golden-leaf.mp4',
        prompt: 'Golden leaf video',
        timestamp: Date.now(),
        projectId: 'proj-1',
        category: 'video',
    },
    {
        id: 'img-2',
        type: 'image',
        url: 'https://storage.googleapis.com/test/cover.png',
        prompt: 'Cover art',
        timestamp: Date.now() - 60000,
        projectId: 'proj-1',
        category: 'image',
    },
];

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
            generatedHistory: mockGeneratedHistory,
            setPrompt: vi.fn(),
            setModule: vi.fn(),
            setSelectedCreativeAsset: vi.fn(),
        }),
}));

describe('AssetSpotlight selected creation placement (ISSUE-1620)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders selected video player and controls above the creations grid', () => {
        const { container } = render(<AssetSpotlight />);

        const firstCard = screen.getByText('Golden leaf video').closest('button');
        expect(firstCard).toBeTruthy();
        fireEvent.click(firstCard!);

        const detail = screen.getByTestId('asset-spotlight-detail');
        expect(detail).toBeInTheDocument();
        expect(screen.getByText('Discuss')).toBeInTheDocument();
        expect(screen.getByText('Studio')).toBeInTheDocument();

        const grid = container.querySelector('.grid.grid-cols-2');
        expect(grid).toBeTruthy();
        // Detail must precede the grid in DOM order so it is immediately visible without scrolling past all items
        expect(Boolean(detail.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });
});

describe('AssetSpotlight selected creation placement (ISSUE-1620)', () => {
    const videoAsset = {
        id: 'vid-1',
        type: 'video' as const,
        url: 'https://storage.googleapis.com/test/golden-leaf.mp4',
        prompt: 'Golden leaf video',
        timestamp: Date.now(),
        projectId: 'proj-1',
        category: 'video',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the expanded detail player above the creations grid when a creation is selected', () => {
        const { container } = render(<AssetSpotlight />);

        const grid = container.querySelector('.grid.grid-cols-2')!;
        expect(screen.queryByTestId('asset-spotlight-detail')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Golden leaf video'));

        const detail = screen.getByTestId('asset-spotlight-detail');
        expect(detail).toBeInTheDocument();
        expect(detail.querySelector('video[controls]')).toHaveAttribute('src', videoAsset.url);
        expect(Boolean(detail.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });

    it('closes the expanded detail player when the close button is clicked', async () => {
        render(<AssetSpotlight />);

        fireEvent.click(screen.getByText('Golden leaf video'));
        expect(screen.getByTestId('asset-spotlight-detail')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close selected creation' }));
        await waitFor(() => {
            expect(screen.queryByTestId('asset-spotlight-detail')).not.toBeInTheDocument();
        });
    });
});
