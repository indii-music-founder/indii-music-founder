import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alwaysOnMemoryEngine } from './memory/AlwaysOnMemoryEngine';

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: { defaultConfig: {} },
    app: { options: {} },
    getFirebaseAI: vi.fn(() => ({})),
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: {},
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    // clearAll() loops `while (!batch.empty)` to paginate deletes (see
    // AlwaysOnMemoryEngine.ts:610-643 and the matching fix in
    // AlwaysOnMemoryEngine.test.ts's "Clear All" block). Without `empty: true`
    // here, `.empty` is undefined and the loop never terminates — it spins
    // forever until the process OOMs.
    getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
    deleteDoc: vi.fn(),
    doc: vi.fn(),
    query: vi.fn(),
    limit: vi.fn(),
    writeBatch: vi.fn(() => ({
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('AlwaysOnMemoryEngine Benchmark', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        alwaysOnMemoryEngine.stop();
    });

    it('measures performance of clearAll', async () => {
        // Start engine
        await alwaysOnMemoryEngine.start('test_user');

        const start = performance.now();
        await alwaysOnMemoryEngine.clearAll();
        const end = performance.now();

        console.log(`AlwaysOnMemoryEngine.clearAll took: ${(end - start).toFixed(2)}ms`);

        expect(end - start).toBeGreaterThanOrEqual(0);
    });
});
