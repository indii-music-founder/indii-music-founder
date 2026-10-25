import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/core/store');
import { useStore } from '@/core/store';

describe('local agent approval', () => {
    afterEach(() => {
        useStore.getState().pendingApproval?.resolve(false);
        useStore.setState({ pendingApproval: null });
        vi.useRealTimers();
    });

    it('rejects a stale request ID and resolves only the matching request', async () => {
        const result = useStore.getState().requestApproval('Publish?', 'tool');
        const pending = useStore.getState().pendingApproval;
        expect(pending).not.toBeNull();
        useStore.getState().resolveApproval(true, '123e4567-e89b-42d3-a456-426614174000');
        expect(useStore.getState().pendingApproval?.id).toBe(pending?.id);
        useStore.getState().resolveApproval(true, pending?.id);
        await expect(result).resolves.toBe(true);
        expect(useStore.getState().pendingApproval).toBeNull();
    });

    it('automatically rejects a request when its window expires', async () => {
        vi.useFakeTimers();
        const result = useStore.getState().requestApproval('Publish?', 'tool');
        await vi.advanceTimersByTimeAsync(120_001);
        await expect(result).resolves.toBe(false);
        expect(useStore.getState().pendingApproval).toBeNull();
    });
});
