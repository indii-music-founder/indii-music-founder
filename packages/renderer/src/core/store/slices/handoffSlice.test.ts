// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandoffSlice } from './handoffSlice';
import type { HandoffSlice } from './handoffSlice';
import type { SendToPayload } from '@/types/handoff';

const mocks = vi.hoisted(() => ({
    toastWarning: vi.fn(),
    mockRootStore: {
        setModule: vi.fn(),
        addActiveAgent: vi.fn(),
        setConversationMode: vi.fn(),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: mocks.toastWarning,
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => mocks.mockRootStore),
    },
}));

function buildSlice() {
    const state: Record<string, unknown> = {
        pendingHandoffs: {},
    };
    const set = (partial: unknown) => {
        const next = typeof partial === 'function' ? (partial as (s: any) => any)(state) : partial;
        Object.assign(state, next);
    };
    const get = () => state;
    const slice = createHandoffSlice(set as any, get as any, {} as any);
    Object.assign(state, slice);
    return state as typeof state & HandoffSlice;
}

function makePayload(assetId: string, timestamp: number): SendToPayload {
    return {
        assetId,
        assetUrl: `https://example.com/${assetId}.png`,
        assetType: 'image',
        prompt: assetId,
        originModule: 'creative',
        timestamp,
    };
}

describe('handoffSlice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps independent pending handoffs per target and carries default target views', async () => {
        const state = buildSlice();
        state.sendToModule('marketing', makePayload('marketing-asset', Date.now()));
        state.sendToModule('touring', makePayload('touring-asset', Date.now()));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(state.pendingHandoffs.marketing?.assetId).toBe('marketing-asset');
        expect(state.pendingHandoffs.marketing?.targetView).toBe('visuals');
        expect(state.pendingHandoffs.touring?.assetId).toBe('touring-asset');
        expect(state.pendingHandoffs.touring?.targetView).toBe('rider');

        expect(state.consumeHandoff('marketing')?.assetId).toBe('marketing-asset');
        expect(state.pendingHandoffs.touring?.assetId).toBe('touring-asset');
        expect(state.consumeHandoff('touring')?.assetId).toBe('touring-asset');
    });

    it('warns when an unconsumed target slot is replaced', async () => {
        const state = buildSlice();
        state.sendToModule('marketing', makePayload('first', Date.now()));
        state.sendToModule('marketing', makePayload('second', Date.now() + 1));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(state.pendingHandoffs.marketing?.assetId).toBe('second');
        expect(mocks.toastWarning).toHaveBeenCalledWith(expect.stringContaining('Replacing an unconsumed marketing handoff'));
    });

    it('expires stale payloads on consume', () => {
        const state = buildSlice();
        const now = 1_000_000;
        vi.spyOn(Date, 'now').mockReturnValue(now);
        state.pendingHandoffs.marketing = makePayload('stale', now - (11 * 60 * 1000));

        expect(state.consumeHandoff('marketing')).toBeNull();
        expect(state.pendingHandoffs.marketing).toBeUndefined();
        expect(mocks.toastWarning).toHaveBeenCalledWith(expect.stringContaining('Expired marketing handoff'));
    });
});
