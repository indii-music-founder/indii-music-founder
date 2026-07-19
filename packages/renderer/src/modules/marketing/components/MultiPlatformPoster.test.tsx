/**
 * ISSUE-666 regression: every selected platform is dispatched independently
 * and gets its own confirmed status — one successful call must never mark the
 * whole post as delivered everywhere.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MultiPlatformPoster from './MultiPlatformPoster';
import { ToastProvider } from '@/core/context/ToastContext';
import { socialAutoPosterService } from '@/services/marketing/SocialAutoPosterService';

vi.mock('@/services/marketing/SocialAutoPosterService', () => ({
    socialAutoPosterService: { queuePost: vi.fn() },
}));

const queuePostMock = vi.mocked(socialAutoPosterService.queuePost);

const createDraft = async (platformNames: string[]) => {
    fireEvent.click(screen.getByRole('button', { name: /New Post/i }));
    fireEvent.change(screen.getByPlaceholderText(/Studio Session/i), { target: { value: 'My clip' } });
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://cdn/x.mp4' } });
    for (const name of platformNames) {
        const toggle = screen.getAllByRole('button', { name: new RegExp(`^${name}$`, 'i') })
            .find(b => b.textContent?.trim() === name);
        if (toggle && name !== 'TikTok') fireEvent.click(toggle); // TikTok pre-selected
    }
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }));
    await screen.findByText('My clip');
};

describe('MultiPlatformPoster (ISSUE-666)', () => {
    beforeEach(() => {
        queuePostMock.mockReset();
    });

    it('dispatches each selected platform and reports per-platform outcomes', async () => {
        // TikTok accepted, YouTube Shorts rejected by backend (not wired natively)
        queuePostMock.mockImplementation(async ({ platform }) => {
            if (platform === 'youtube_shorts') throw new Error("not wired for native delivery");
            return 'job1';
        });

        render(<ToastProvider><MultiPlatformPoster /></ToastProvider>);
        await createDraft(['TikTok', 'YouTube Shorts']);

        fireEvent.click(screen.getByRole('button', { name: /Post Now/i }));

        await waitFor(() => {
            expect(screen.getByText(/TikTok: Queued for delivery/i)).toBeInTheDocument();
            expect(screen.getByText(/YouTube Shorts: Failed/i)).toBeInTheDocument();
        });

        // one dispatch per selected platform — not just platforms[0]
        expect(queuePostMock).toHaveBeenCalledTimes(2);
        const platforms = queuePostMock.mock.calls.map(([c]) => c.platform).sort();
        expect(platforms).toEqual(['tiktok', 'youtube_shorts']);
        // Nothing claims a blanket "Posted"
        expect(screen.queryByText(/^Posted$/)).not.toBeInTheDocument();
    });

    it('never marks a platform queued when its dispatch failed', async () => {
        queuePostMock.mockRejectedValue(new Error('backend down'));

        render(<ToastProvider><MultiPlatformPoster /></ToastProvider>);
        await createDraft(['TikTok']);

        fireEvent.click(screen.getByRole('button', { name: /Post Now/i }));

        await waitFor(() => {
            expect(screen.getByText(/TikTok: Failed/i)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Queued for delivery/i)).not.toBeInTheDocument();
    });
});
