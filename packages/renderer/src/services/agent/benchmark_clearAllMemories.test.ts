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
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
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

        expect(true).toBe(true);
    });
});
