import { describe, it, expect, vi, beforeEach } from 'vitest';

const queuePost = vi.hoisted(() => vi.fn());
vi.mock('@/services/marketing/SocialAutoPosterService', () => ({
    socialAutoPosterService: { queuePost },
}));

import { SocialTools } from '@/services/agent/tools/SocialTools';

const args = {
    videoUrl: 'https://example.com/v.mp4',
    caption: 'New single out now',
    platforms: ['TikTok', 'YouTube Shorts', 'IG Reels'] as Array<'TikTok' | 'YouTube Shorts' | 'IG Reels'>,
    width: 1080, height: 1920, durationSeconds: 20,
};
const run = () => (SocialTools.multi_platform_autopost as (a: unknown) => Promise<any>)(args);

describe('multi_platform_autopost partial failure', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reports success with a job per platform when every post queues', async () => {
        queuePost.mockResolvedValueOnce('j1').mockResolvedValueOnce('j2').mockResolvedValueOnce('j3');
        const result = await run();
        expect(result.success).toBe(true);
        expect(result.data.posts.map((p: { status: string }) => p.status)).toEqual(['queued', 'queued', 'queued']);
    });

    it('does not hide platforms that already queued when another one is rejected', async () => {
        queuePost
            .mockResolvedValueOnce('j1')
            .mockResolvedValueOnce('j2')
            .mockRejectedValueOnce(new Error('Instagram policy rejected this post: aspect ratio'));
        const result = await run();

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('AUTOPOST_PARTIAL_FAILURE');
        expect(result.metadata?.posts).toEqual([
            { platform: 'TikTok', status: 'queued', jobId: 'j1' },
            { platform: 'YouTube Shorts', status: 'queued', jobId: 'j2' },
            { platform: 'IG Reels', status: 'failed', error: 'Instagram policy rejected this post: aspect ratio' },
        ]);
        // The user must be told not to resubmit the platforms that went through.
        expect(result.error).toMatch(/TikTok.*YouTube Shorts.*already queued/is);
        expect(result.error).toContain('IG Reels');
    });

    it('reports a plain failure when nothing queued', async () => {
        queuePost.mockRejectedValue(new Error('Cloud Function returned failure status'));
        const result = await run();
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('AUTOPOST_QUEUE_FAILED');
    });
});
