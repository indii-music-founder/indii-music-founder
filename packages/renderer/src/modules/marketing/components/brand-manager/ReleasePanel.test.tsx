import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => toast }));
vi.mock('motion/react', () => ({
    motion: new Proxy({}, { get: () => (props: Record<string, unknown>) => <div>{props.children as never}</div> }),
}));

import ReleasePanel from './ReleasePanel';

const release = {
    title: 'Night Drive', type: 'Single', artists: 'Detroit Artist', genre: 'Hip Hop', mood: 'Dark',
    themes: '', lyrics: '', releaseDate: '2026-01-01', coverArtUrl: '', tracks: [],
};

const setup = (saveBrandKit: (updates: unknown) => Promise<boolean>) => {
    const updateBrandKit = vi.fn();
    const utils = render(
        <ReleasePanel
            userProfile={{ id: 'u1' } as never}
            brandKit={{} as never}
            release={release as never}
            updateBrandKit={updateBrandKit}
            saveBrandKit={saveBrandKit as never}
            setUserProfile={vi.fn()}
        />,
    );
    return { ...utils, updateBrandKit };
};

describe('ReleasePanel saving', () => {
    beforeEach(() => vi.clearAllMocks());

    it('saves the date the user just picked, not the previous render\'s value', async () => {
        const saveBrandKit = vi.fn().mockResolvedValue(true);
        const { container } = setup(saveBrandKit);
        fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-12-25' } });

        await waitFor(() => expect(saveBrandKit).toHaveBeenCalled());
        expect(saveBrandKit.mock.calls[0]![0]).toEqual({
            releaseDetails: expect.objectContaining({ releaseDate: '2026-12-25' }),
        });
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Release details saved'));
    });

    it('does not announce "saved" when the write failed', async () => {
        const saveBrandKit = vi.fn().mockResolvedValue(false);
        const { container } = setup(saveBrandKit);
        fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-12-25' } });

        await waitFor(() => expect(saveBrandKit).toHaveBeenCalled());
        await Promise.resolve();
        expect(toast.success).not.toHaveBeenCalled();
    });
});
