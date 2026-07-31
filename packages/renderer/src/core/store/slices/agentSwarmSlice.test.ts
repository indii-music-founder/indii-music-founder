import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreApi } from 'zustand';

import { createAgentSwarmSlice, type AgentSwarmSlice } from './agentSwarmSlice';

/**
 * The behaviour worth pinning here is the halt switch. It governs real ad
 * spend, so a failed write must never leave the UI showing "halted" while the
 * backend is still allowed to buy.
 */

const currentUser = { uid: 'artist-uid' };

vi.mock('@/services/firebase', () => ({
    auth: { get currentUser() { return currentUser.uid ? { uid: currentUser.uid } : null; } },
    db: {},
    functions: {},
}));

const setDoc = vi.fn();
const getDoc = vi.fn();
const onSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    getDoc: (...args: unknown[]) => getDoc(...args),
    setDoc: (...args: unknown[]) => setDoc(...args),
    onSnapshot: (...args: unknown[]) => onSnapshot(...args),
}));

const callable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: () => callable,
}));

/** Minimal harness — the slice only ever touches set/get. */
function makeSlice(): { state: AgentSwarmSlice } {
    const holder = { state: null as unknown as AgentSwarmSlice };
    const set = (partial: Partial<AgentSwarmSlice> | ((s: AgentSwarmSlice) => Partial<AgentSwarmSlice>)) => {
        const next = typeof partial === 'function' ? partial(holder.state) : partial;
        holder.state = { ...holder.state, ...next };
    };
    const get = () => holder.state;
    holder.state = createAgentSwarmSlice(
        set as never,
        get as never,
        {} as StoreApi<AgentSwarmSlice>,
    );
    return holder;
}

beforeEach(() => {
    vi.clearAllMocks();
    currentUser.uid = 'artist-uid';
    setDoc.mockResolvedValue(undefined);
    getDoc.mockResolvedValue({ data: () => ({ isActive: true }) });
});

describe('toggleSwarmStatus', () => {
    it('persists the halt state so the backend honours it', async () => {
        const holder = makeSlice();

        await holder.state.toggleSwarmStatus(false);

        expect(setDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ isActive: false }),
            { merge: true },
        );
        expect(holder.state.isSwarmActive).toBe(false);
        expect(holder.state.swarmStatusError).toBeNull();
    });

    it('rolls the toggle back and warns when the halt write fails', async () => {
        setDoc.mockRejectedValue(new Error('offline'));
        const holder = makeSlice();

        await holder.state.toggleSwarmStatus(false);

        // Still active, because the backend never learned about the halt.
        expect(holder.state.isSwarmActive).toBe(true);
        expect(holder.state.swarmStatusError).toContain('may still be running');
        expect(holder.state.swarmStatusError).toContain('offline');
    });

    it('refuses to toggle without an authenticated user', async () => {
        currentUser.uid = '';
        const holder = makeSlice();

        await holder.state.toggleSwarmStatus(false);

        expect(setDoc).not.toHaveBeenCalled();
        expect(holder.state.swarmStatusError).toBe('Sign in to control the swarm.');
    });
});

describe('loadSwarmStatus', () => {
    it('reflects the persisted state', async () => {
        getDoc.mockResolvedValue({ data: () => ({ isActive: false }) });
        const holder = makeSlice();

        await holder.state.loadSwarmStatus();

        expect(holder.state.isSwarmActive).toBe(false);
    });

    it('defaults to active when the setting was never written', async () => {
        getDoc.mockResolvedValue({ data: () => undefined });
        const holder = makeSlice();

        await holder.state.loadSwarmStatus();

        expect(holder.state.isSwarmActive).toBe(true);
    });
});

describe('fetchCampaignMetrics', () => {
    it('stores the returned series', async () => {
        const metrics = [{ date: '2026-07-28', total_spend: 50, total_revenue: 120, total_clicks: 90, total_conversions: 4 }];
        callable.mockResolvedValue({ data: { ok: true, metrics } });
        const holder = makeSlice();

        await holder.state.fetchCampaignMetrics(7);

        expect(callable).toHaveBeenCalledWith({ rangeDays: 7 });
        expect(holder.state.campaignMetrics).toEqual(metrics);
        expect(holder.state.swarmMetricsLoading).toBe(false);
    });

    it('clears the series on failure rather than showing stale spend', async () => {
        callable.mockResolvedValue({ data: { ok: true, metrics: [{ date: '2026-07-01', total_spend: 10, total_revenue: 20, total_clicks: 5, total_conversions: 1 }] } });
        const holder = makeSlice();
        await holder.state.fetchCampaignMetrics();

        callable.mockRejectedValue(new Error('warehouse down'));
        await holder.state.fetchCampaignMetrics();

        expect(holder.state.campaignMetrics).toEqual([]);
        expect(holder.state.swarmMetricsError).toBe('warehouse down');
        expect(holder.state.swarmMetricsLoading).toBe(false);
    });
});

describe('subscribeAgentLogs', () => {
    it('normalizes documents and returns the unsubscribe handle', () => {
        const unsubscribe = vi.fn();
        onSnapshot.mockImplementation((_query, onNext) => {
            onNext({
                docs: [{
                    id: 'log-1',
                    data: () => ({
                        agentName: 'Media Buyer',
                        actionType: 'paused_ad',
                        message: 'Paused ad 123.',
                        status: 'success',
                        timestamp: '2026-07-28T10:00:00.000Z',
                    }),
                }],
            });
            return unsubscribe;
        });
        const holder = makeSlice();

        const returned = holder.state.subscribeAgentLogs();

        expect(returned).toBe(unsubscribe);
        expect(holder.state.agentLogs).toEqual([{
            id: 'log-1',
            agentName: 'Media Buyer',
            actionType: 'paused_ad',
            message: 'Paused ad 123.',
            status: 'success',
            timestamp: '2026-07-28T10:00:00.000Z',
        }]);
    });

    it('normalizes an unrecognized action type instead of rendering it raw', () => {
        onSnapshot.mockImplementation((_query, onNext) => {
            onNext({ docs: [{ id: 'log-2', data: () => ({ actionType: 'invented_later', status: 'weird' }) }] });
            return vi.fn();
        });
        const holder = makeSlice();

        holder.state.subscribeAgentLogs();

        expect(holder.state.agentLogs[0]).toMatchObject({
            actionType: 'generated_creative',
            status: 'pending',
            agentName: 'Swarm',
        });
    });

    it('surfaces an error and no-ops when signed out', () => {
        currentUser.uid = '';
        const holder = makeSlice();

        const unsubscribe = holder.state.subscribeAgentLogs();

        expect(onSnapshot).not.toHaveBeenCalled();
        expect(holder.state.swarmLogsError).toBe('Sign in to see agent activity.');
        expect(() => unsubscribe()).not.toThrow();
    });
});
