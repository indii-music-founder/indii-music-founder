import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssetSpotlight from './AssetSpotlight';

/**
 * ISSUE-752: "Discuss" used to only prefill commandBarInput with a text
 * snippet of the prompt — the model never saw the actual image, so the
 * conversation was blind. This was already fixed (commit 88f3681d1, prior
 * session) by fetching the asset and routing it through the real
 * commandBarAttachments pipeline the paperclip flow uses, but the ledger
 * entry was never updated and no test locked the behavior in. These tests
 * verify the fix and guard against a future regression.
 */

const { mockState, mockSetState } = vi.hoisted(() => {
    const mockState: Record<string, unknown> = {
        generatedHistory: [],
        setModule: vi.fn(),
        setSelectedItem: vi.fn(),
        setRightPanelTab: vi.fn(),
        setRightPanelView: vi.fn(),
    };
    const mockSetState = vi.fn((patch: unknown) => {
        const next = typeof patch === 'function' ? (patch as (s: typeof mockState) => Partial<typeof mockState>)(mockState) : patch;
        Object.assign(mockState, next);
    });
    return { mockState, mockSetState };
});

vi.mock('@/core/store', () => {
    const useStoreMock = Object.assign(
        (selector?: (s: typeof mockState) => unknown) => (selector ? selector(mockState) : mockState),
        { setState: mockSetState, getState: () => mockState }
    );
    return { useStore: useStoreMock };
});

const asset = {
    id: 'asset-1',
    type: 'image' as const,
    url: 'https://cdn.example/generated.png',
    thumbnailUrl: 'https://cdn.example/generated-thumb.png',
    prompt: 'A neon Detroit skyline at dusk',
    timestamp: Date.now(),
    category: 'Creative',
};

describe('AssetSpotlight — Discuss attaches the actual asset (ISSUE-752)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.generatedHistory = [asset];
        mockState.commandBarAttachments = [];
        mockState.commandBarInput = '';
        mockState.isRightPanelOpen = false;
        mockState.currentModule = undefined;
        window.innerWidth = 1024; // desktop path by default
        global.fetch = vi.fn(async () => ({
            blob: async () => new Blob(['fake-image-bytes'], { type: 'image/png' }),
        })) as unknown as typeof fetch;
    });

    it('attaches the fetched asset as a File via commandBarAttachments — not just a text prefill', async () => {
        render(<AssetSpotlight />);

        fireEvent.click(screen.getByText('A neon Detroit skyline at dusk'));
        fireEvent.click(screen.getByText('Discuss'));

        await waitFor(() => {
            expect(mockState.commandBarAttachments).toHaveLength(1);
        });
        const attachments = mockState.commandBarAttachments as File[];
        expect(attachments[0]).toBeInstanceOf(File);
        expect(attachments[0]!.type).toBe('image/png');

        // The text prefill still carries context, but is no longer the ONLY
        // thing the model receives — that was the actual reported defect.
        expect(mockState.commandBarInput).toContain('image');
        expect(mockState.commandBarInput).toContain('A neon Detroit skyline');
    });

    it('opens the agent panel focused on messages after Discuss (desktop)', async () => {
        render(<AssetSpotlight />);

        fireEvent.click(screen.getByText('A neon Detroit skyline at dusk'));
        fireEvent.click(screen.getByText('Discuss'));

        await waitFor(() => expect(mockState.commandBarAttachments).toHaveLength(1));
        expect(mockState.isRightPanelOpen).toBe(true);
        expect(mockState.setRightPanelTab).toHaveBeenCalledWith('agent');
        expect(mockState.setRightPanelView).toHaveBeenCalledWith('messages');
    });

    it('also attaches the asset on the mobile fallback path (<768px)', async () => {
        window.innerWidth = 500;
        render(<AssetSpotlight />);

        fireEvent.click(screen.getByText('A neon Detroit skyline at dusk'));
        fireEvent.click(screen.getByText('Discuss'));

        await waitFor(() => expect(mockState.commandBarAttachments).toHaveLength(1));
        expect(mockState.currentModule).toBe('agent');
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
        mockState.generatedHistory = [videoAsset, asset];
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
