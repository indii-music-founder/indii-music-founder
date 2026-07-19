import { describe, expect, it } from 'vitest';
import {
    completePlpSlot,
    createPlpBatch,
    failPlpSlot,
    getEligiblePlpSlots,
    getPlpBatchCounts,
    retryPlpSlot,
} from './plpBatch';

describe('PLP batch lifecycle', () => {
    it('starts with ten queued image slots and five queued video slots', () => {
        const batch = createPlpBatch('batch-1', 'project-1', 'launch prompt');

        expect(batch.slots.filter(slot => slot.kind === 'image')).toHaveLength(10);
        expect(batch.slots.filter(slot => slot.kind === 'video')).toHaveLength(5);
        expect(getPlpBatchCounts(batch)).toEqual({ queued: 15, completed: 0, failed: 0 });
        expect(getEligiblePlpSlots(batch)).toEqual([]);
    });

    it('accepts exactly one immutable terminal result per slot', () => {
        const batch = createPlpBatch('batch-1', 'project-1', 'launch prompt');
        const completed = completePlpSlot(batch, 10, {
            id: 'video-job-1',
            url: 'https://cdn.example/video-1.mp4',
            prompt: 'first terminal event',
        });
        const duplicate = completePlpSlot(completed, 10, {
            id: 'video-job-duplicate',
            url: 'https://cdn.example/duplicate.mp4',
            prompt: 'duplicate listener event',
        });

        expect(duplicate.slots[10]?.result).toEqual(completed.slots[10]?.result);
        expect(getEligiblePlpSlots(duplicate).map(slot => slot.result?.id)).toEqual(['video-job-1']);
    });

    it('keeps failed and output-less slots ineligible and retries only the failed slot', () => {
        const batch = createPlpBatch('batch-1', 'project-1', 'launch prompt');
        const outputLess = completePlpSlot(batch, 10, { id: 'job-no-url', url: '', prompt: 'bad' });
        const failed = failPlpSlot(outputLess, 11, 'Provider cancelled the render.');
        const retrying = retryPlpSlot(failed, 11);

        expect(outputLess.slots[10]?.status).toBe('queued');
        expect(failed.slots[11]).toMatchObject({ status: 'failed', attempt: 1 });
        expect(retrying.slots[11]).toMatchObject({ status: 'queued', attempt: 2 });
        expect(retrying.slots[10]).toMatchObject({ status: 'queued', attempt: 1 });
        expect(getEligiblePlpSlots(retrying)).toEqual([]);
    });
});
