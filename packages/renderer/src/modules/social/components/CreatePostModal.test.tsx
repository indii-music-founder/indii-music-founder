import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import CreatePostModal from './CreatePostModal';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock useToast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    }),
}));

// Mock BrandAssetsDrawer to avoid testing its internal a11y issues here
vi.mock('../../creative/components/BrandAssetsDrawer', () => ({
    default: ({ onSelect }: { onSelect: (asset: { url: string; storageUri?: string; description?: string }) => void }) => (
        <button data-testid="brand-assets-drawer" onClick={() => onSelect({
            url: 'data:image/png;base64,temporary',
            storageUri: 'gs://bucket/users/artist/feed.png',
            description: 'Verified feed asset',
        })}>Select verified asset</button>
    ),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn(async () => 'https://cdn.example.test/feed.png'),
}));

describe('CreatePostModal Accessibility', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        class MeasuredImage {
            naturalWidth = 1080;
            naturalHeight = 1350;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_value: string) { queueMicrotask(() => this.onload?.()); }
        }
        vi.stubGlobal('Image', MeasuredImage);
    });

    it('should have no accessibility violations', async () => {
        const { container } = render(
            <CreatePostModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    }, 15000);

    it('should use semantic structure for dialog', () => {
        const { getByRole } = render(
            <CreatePostModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        // This will likely fail initially
        expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('schedules only after a project asset resolves to a verified 4:5 publishing payload', async () => {
        const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE');
        mockOnSave.mockResolvedValue(true);
        render(<CreatePostModal onClose={mockOnClose} onSave={mockOnSave} initialScheduledDate={tomorrow} />);

        fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
        fireEvent.change(screen.getByLabelText('Post Copy'), { target: { value: 'New release out now.' } });
        fireEvent.change(screen.getByLabelText('Feed hashtags (3–5 specific tags)'), { target: { value: '#detroitindie #synthpop #newrelease' } });
        fireEvent.click(screen.getByRole('button', { name: 'Select media from Brand Assets' }));
        fireEvent.click(screen.getByTestId('brand-assets-drawer'));

        await waitFor(() => expect(screen.getByAltText('Verified feed asset')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Schedule Post' }));

        await waitFor(() => expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
            imageAsset: expect.objectContaining({ imageUrl: 'https://cdn.example.test/feed.png', width: 1080, height: 1350 }),
            instagramPayload: expect.objectContaining({ surface: 'feed', width: 1080, height: 1350, hashtags: ['detroitindie', 'synthpop', 'newrelease'] }),
        })));
    });
});
