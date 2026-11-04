import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createMemoryAgentSlice, type MemoryAgentSlice } from './memoryAgentSlice';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { auth } from '@/services/firebase';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'artist-a' } },
    db: {},
}));

vi.mock('@/services/agent/memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        getStatus: vi.fn().mockResolvedValue({ isRunning: true }),
        getAllMemories: vi.fn(),
        getInsights: vi.fn(),
    },
}));

vi.mock('@/services/directive/DirectiveService', () => ({
    DirectiveService: { getAllDirectives: vi.fn() },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    Timestamp: class {},
}));

describe('memory account boundary', () => {
    const signedInAs = (uid: string) => {
        Object.defineProperty(auth, 'currentUser', {
            configurable: true,
            value: { uid },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        signedInAs('artist-a');
    });

    it('clears account-owned memory state when the engine stops', () => {
        const store = createStore<MemoryAgentSlice>()(createMemoryAgentSlice);
        store.setState({
            alwaysOnMemories: [{ id: 'old-memory' } as MemoryAgentSlice['alwaysOnMemories'][number]],
            alwaysOnInsights: [{ id: 'old-insight' } as MemoryAgentSlice['alwaysOnInsights'][number]],
            activeDirectives: [{ id: 'old-directive' } as MemoryAgentSlice['activeDirectives'][number]],
            memoryInboxItems: [{ id: 'old-inbox' } as MemoryAgentSlice['memoryInboxItems'][number]],
            selectedMemoryId: 'old-memory',
        });

        store.getState().stopMemoryEngine();

        expect(alwaysOnMemoryEngine.stop).toHaveBeenCalledOnce();
        expect(store.getState().alwaysOnMemories).toEqual([]);
        expect(store.getState().alwaysOnInsights).toEqual([]);
        expect(store.getState().activeDirectives).toEqual([]);
        expect(store.getState().memoryInboxItems).toEqual([]);
        expect(store.getState().selectedMemoryId).toBeNull();
    });

    it('drops a late read from the previous signed-in account', async () => {
        const store = createStore<MemoryAgentSlice>()(createMemoryAgentSlice);
        let finishRead!: (memories: MemoryAgentSlice['alwaysOnMemories']) => void;
        vi.mocked(alwaysOnMemoryEngine.getAllMemories).mockReturnValueOnce(
            new Promise(resolve => { finishRead = resolve; })
        );

        const pending = store.getState().loadAlwaysOnMemories();
        signedInAs('artist-b');
        store.getState().stopMemoryEngine();
        finishRead([{ id: 'artist-a-memory' } as MemoryAgentSlice['alwaysOnMemories'][number]]);
        await pending;

        expect(store.getState().alwaysOnMemories).toEqual([]);
    });

    it('drops a late status refresh from the previous signed-in account', async () => {
        const store = createStore<MemoryAgentSlice>()(createMemoryAgentSlice);
        let finishStatus!: (status: MemoryAgentSlice['alwaysOnEngineStatus']) => void;
        vi.mocked(alwaysOnMemoryEngine.getStatus).mockReturnValueOnce(
            new Promise(resolve => { finishStatus = resolve; })
        );

        const pending = store.getState().refreshAlwaysOnEngineStatus();
        signedInAs('artist-b');
        store.getState().stopMemoryEngine();
        finishStatus({ ...store.getState().alwaysOnEngineStatus, isRunning: true, totalMemories: 5 });
        await pending;

        expect(store.getState().alwaysOnEngineStatus.isRunning).toBe(false);
        expect(store.getState().alwaysOnEngineStatus.totalMemories).toBe(0);
    });
});
