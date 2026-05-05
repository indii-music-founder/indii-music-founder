import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
    ingestFromSessionMock: vi.fn(async () => 3),
    getDocMock: vi.fn(),
    setDocMock: vi.fn(async () => undefined),
    mockState: {
        activeSessionId: null as string | null,
        sessions: {} as Record<string, { id: string; messages: Array<{ role: string; text: string }> }>,
    },
}));

const { ingestFromSessionMock, getDocMock, setDocMock, mockState } = hoisted;

vi.mock('./AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        ingestFromSession: hoisted.ingestFromSessionMock,
    },
}));

vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
    return {
        ...actual,
        doc: vi.fn(() => ({ id: 'cfg' })),
        getDoc: (...args: unknown[]) => hoisted.getDocMock(...args as []),
        setDoc: (...args: unknown[]) => hoisted.setDocMock(...args as []),
    };
});

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => hoisted.mockState,
    },
}));

import { AutoMemoryExtractor } from './AutoMemoryExtractor';

const resetSingleton = () => {
    // The module exports a singleton; tests need a fresh instance.
    // Instance reset via the public API: stop + reach into the static field.
    (AutoMemoryExtractor as unknown as { instance: AutoMemoryExtractor | null }).instance = null;
};

describe('AutoMemoryExtractor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        ingestFromSessionMock.mockClear();
        getDocMock.mockReset();
        setDocMock.mockClear();
        resetSingleton();
        mockState.activeSessionId = null;
        mockState.sessions = {};
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('exposes a singleton', () => {
        const a = AutoMemoryExtractor.getInstance();
        const b = AutoMemoryExtractor.getInstance();
        expect(a).toBe(b);
    });

    it('start() is idempotent — calling twice does not stack timers', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-1');
        await extractor.start('user-1');
        // No assertion on timer count directly; just ensure no throw.
        extractor.stop();
    });

    it('extractNow() returns 0 when there is no active session', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-2');
        mockState.activeSessionId = null;
        const count = await extractor.extractNow();
        expect(count).toBe(0);
        expect(ingestFromSessionMock).not.toHaveBeenCalled();
    });

    it('extractNow() returns 0 when the active session has no messages', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-3');
        mockState.activeSessionId = 's1';
        mockState.sessions = { s1: { id: 's1', messages: [] } };
        const count = await extractor.extractNow();
        expect(count).toBe(0);
    });

    it('extractNow() ingests recent messages and returns the count', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-4');
        mockState.activeSessionId = 's2';
        mockState.sessions = {
            s2: {
                id: 's2',
                messages: [
                    { role: 'user', text: 'hi' },
                    { role: 'model', text: 'hello' },
                ],
            },
        };
        const count = await extractor.extractNow();
        expect(count).toBe(3); // mock returns 3
        expect(ingestFromSessionMock).toHaveBeenCalledOnce();
        const call = ingestFromSessionMock.mock.calls[0] as unknown as unknown[];
        expect(call[1]).toBe('s2');
        expect(call[0]).toHaveLength(2);
    });

    it('extractNow() filters empty messages', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-5');
        mockState.activeSessionId = 's3';
        mockState.sessions = {
            s3: {
                id: 's3',
                messages: [
                    { role: 'user', text: 'hi' },
                    { role: 'system', text: '' },
                    { role: 'model', text: 'hey' },
                ],
            },
        };
        await extractor.extractNow();
        const call = ingestFromSessionMock.mock.calls[0] as unknown as unknown[];
        const recentMsgs = call[0] as Array<unknown>;
        expect(recentMsgs).toHaveLength(2);
    });

    it('extractNow() truncates to last 20 messages', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-6');
        const messages = Array.from({ length: 30 }, (_, i) => ({ role: 'user', text: `msg-${i}` }));
        mockState.activeSessionId = 's4';
        mockState.sessions = { s4: { id: 's4', messages } };
        await extractor.extractNow();
        const call = ingestFromSessionMock.mock.calls[0] as unknown as unknown[];
        const recentMsgs = call[0] as Array<{ text: string }>;
        expect(recentMsgs).toHaveLength(20);
        expect(recentMsgs[0]?.text).toBe('msg-10');
    });

    it('getConfig returns defaults when no Firestore doc exists', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-7');
        const cfg = await extractor.getConfig();
        expect(cfg.enabled).toBe(true);
        expect(cfg.extractIntervalMs).toBe(5 * 60 * 1000);
    });

    it('getConfig merges Firestore data over defaults', async () => {
        getDocMock.mockResolvedValue({
            exists: () => true,
            data: () => ({ enabled: false, extractIntervalMs: 60_000 }),
        });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-8');
        const cfg = await extractor.getConfig();
        expect(cfg.enabled).toBe(false);
        expect(cfg.extractIntervalMs).toBe(60_000);
    });

    it('updateConfig persists merged config to Firestore', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-9');
        await extractor.updateConfig({ enabled: false });
        expect(setDocMock).toHaveBeenCalledOnce();
        const call = setDocMock.mock.calls[0] as unknown as unknown[];
        const payload = call[1] as { enabled: boolean; extractIntervalMs: number };
        const opts = call[2];
        expect(payload.enabled).toBe(false);
        expect(payload.extractIntervalMs).toBe(5 * 60 * 1000);
        expect(opts).toEqual({ merge: true });
    });

    it('extractNow swallows errors without throwing', async () => {
        getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
        ingestFromSessionMock.mockRejectedValueOnce(new Error('engine boom'));
        const extractor = AutoMemoryExtractor.getInstance();
        await extractor.start('user-10');
        mockState.activeSessionId = 's5';
        mockState.sessions = {
            s5: { id: 's5', messages: [{ role: 'user', text: 'hi' }] },
        };
        const count = await extractor.extractNow();
        expect(count).toBe(0);
    });
});
