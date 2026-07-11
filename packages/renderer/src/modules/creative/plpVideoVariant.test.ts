import { describe, expect, it, vi } from 'vitest';
import { awaitCompletedPlpVideoVariant } from './plpVideoVariant';

describe('awaitCompletedPlpVideoVariant', () => {
    it('does not return the queued empty URL and waits for playable output', async () => {
        const start = vi.fn().mockResolvedValue([{ id: 'job-1', url: '', prompt: 'variant' }]);
        const wait = vi.fn().mockResolvedValue({ output: { url: 'https://cdn/video.mp4' } });

        await expect(awaitCompletedPlpVideoVariant(start, wait)).resolves.toEqual([
            { id: 'job-1', url: 'https://cdn/video.mp4', prompt: 'variant' },
        ]);
        expect(wait).toHaveBeenCalledWith('job-1');
    });

    it('rejects missing job IDs and completed jobs without output', async () => {
        await expect(awaitCompletedPlpVideoVariant(
            async () => [],
            async () => ({ url: 'unused' }),
        )).rejects.toThrow(/job ID/);

        await expect(awaitCompletedPlpVideoVariant(
            async () => [{ id: 'job-2', url: '', prompt: 'variant' }],
            async () => ({}),
        )).rejects.toThrow(/no playable output URL/);
    });
});
