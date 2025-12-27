import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncWorkflows } from './repository';
import { openDB } from 'idb';
import { setDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../firebase', () => ({
    auth: { currentUser: { uid: 'test-user-123' } },
    storage: {},
    db: {}
}));

vi.mock('idb', () => ({
    openDB: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn().mockReturnValue({ id: 'mock-doc-ref' }),
    setDoc: vi.fn(), // We check this call
    collection: vi.fn()
}));

// Mock `repository` itself partially? 
// No, we are testing `repository.ts`. `initDB` is exported but also used internally.
// We need to mock the returned DB from `initDB`.
// Since we import `initDB` from `./repository` in the test, we mock `./repository`.
// Wait, testing a module while mocking its internal function is tricky in ESM.
// Better to mock `idb.openDB`.

describe('repository syncWorkflows', () => {
    interface MockIDB {
        put: any;
        get: any;
        getAll: any;
    }

    let mockPut: ReturnType<typeof vi.fn>;
    let mockGet: ReturnType<typeof vi.fn>;
    let mockGetAll: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPut = vi.fn();
        mockGet = vi.fn();
        mockGetAll = vi.fn();

        (vi.mocked(openDB)).mockResolvedValue({
            put: mockPut,
            get: mockGet,
            getAll: mockGetAll
        } as any);
    });

    it('should push local workflows to cloud', async () => {
        const localData = [
            { id: 'wf1', name: 'Workflow 1' },
            { id: 'wf2', name: 'Workflow 2' }
        ];
        mockGetAll.mockResolvedValue(localData);

        await syncWorkflows();

        expect(mockGetAll).toHaveBeenCalledWith('workflows');
        expect(setDoc).toHaveBeenCalledTimes(2);
        // Verify setDoc is called with merge: true and synced: true
        expect(setDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ id: 'wf1', name: 'Workflow 1', synced: true }),
            expect.objectContaining({ merge: true })
        );
    });
});
