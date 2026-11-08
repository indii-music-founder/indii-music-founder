import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    saveAssetToStorage,
    saveWorkflowToStorage,
    getWorkflowFromStorage,
    getAllWorkflowsFromStorage,
    syncWorkflows
} from './repository';
import { openDB } from 'idb';
import { setDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

// Mock dependencies
vi.mock('../firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: { currentUser: { uid: 'test-user-123' } },
    storage: {},
    db: {},
    functions: {},
    functionsWest1: {}
}));

vi.mock('idb', () => ({
    serverTimestamp: vi.fn(),
    openDB: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    doc: vi.fn().mockReturnValue({ id: 'mock-doc-ref' }),
    setDoc: vi.fn(),
    collection: vi.fn().mockReturnValue({ id: 'mock-collection-ref' }),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn().mockReturnValue({ id: 'mock-query-ref' }),
    where: vi.fn()
}));

vi.mock('firebase/storage', () => ({
    serverTimestamp: vi.fn(),
    ref: vi.fn().mockReturnValue({ id: 'mock-storage-ref' }),
    uploadBytes: vi.fn().mockResolvedValue({}),
    getBlob: vi.fn()
}));

describe('repository workflows & asset storage', () => {

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
        } as unknown as import('idb').IDBPDatabase);
    });

    it('should push local workflows to root workflows collection with userId', async () => {
        const localData = [
            { id: 'wf1', name: 'Workflow 1' },
            { id: 'wf2', name: 'Workflow 2' }
        ];
        mockGetAll.mockResolvedValue(localData);

        await syncWorkflows();

        expect(mockGetAll).toHaveBeenCalledWith('workflows');
        expect(doc).toHaveBeenCalledWith(expect.anything(), 'workflows', 'wf1');
        expect(doc).toHaveBeenCalledWith(expect.anything(), 'workflows', 'wf2');
        expect(setDoc).toHaveBeenCalledTimes(2);
        expect(setDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ id: 'wf1', name: 'Workflow 1', userId: 'test-user-123', synced: true }),
            expect.objectContaining({ merge: true })
        );
    });

    it('should save workflow to root workflows collection with userId', async () => {
        await saveWorkflowToStorage({ id: 'wf-abc', name: 'Custom Flow' } as any);

        expect(mockPut).toHaveBeenCalledWith('workflows', expect.objectContaining({ id: 'wf-abc', name: 'Custom Flow' }));
        expect(doc).toHaveBeenCalledWith(expect.anything(), 'workflows', 'wf-abc');
        expect(setDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ id: 'wf-abc', name: 'Custom Flow', userId: 'test-user-123', synced: true }),
            expect.objectContaining({ merge: true })
        );
    });

    it('should fetch workflow from root workflows collection if not local', async () => {
        mockGet.mockResolvedValue(undefined);
        vi.mocked(getDoc).mockResolvedValue({
            exists: () => true,
            data: () => ({ id: 'wf-remote', name: 'Remote Flow', userId: 'test-user-123' })
        } as any);

        const result = await getWorkflowFromStorage('wf-remote');

        expect(doc).toHaveBeenCalledWith(expect.anything(), 'workflows', 'wf-remote');
        expect(result).toEqual({ id: 'wf-remote', name: 'Remote Flow', userId: 'test-user-123' });
        expect(mockPut).toHaveBeenCalledWith('workflows', { id: 'wf-remote', name: 'Remote Flow', userId: 'test-user-123' });
    });

    it('should query root workflows collection with userId filter in getAllWorkflowsFromStorage', async () => {
        mockGetAll.mockResolvedValue([{ id: 'wf-local', name: 'Local Flow' }]);
        vi.mocked(getDocs).mockResolvedValue({
            docs: [
                { data: () => ({ id: 'wf-cloud', name: 'Cloud Flow', userId: 'test-user-123' }) }
            ]
        } as any);

        await getAllWorkflowsFromStorage();

        expect(mockPut).toHaveBeenCalledWith('workflows', { id: 'wf-cloud', name: 'Cloud Flow', userId: 'test-user-123' });
    });

    it('should upload asset with fallback contentType image/png when blob.type is empty', async () => {
        const extensionlessBlob = new Blob(['sample-data'], { type: '' });
        const assetId = await saveAssetToStorage(extensionlessBlob);

        expect(typeof assetId).toBe('string');
        expect(mockPut).toHaveBeenCalledWith('assets', extensionlessBlob, assetId);
        expect(ref).toHaveBeenCalledWith(expect.anything(), `users/test-user-123/assets/${assetId}`);
        expect(uploadBytes).toHaveBeenCalledWith(
            expect.anything(),
            extensionlessBlob,
            { contentType: 'image/png' }
        );
    });

    it('should upload asset preserving existing blob.type when specified', async () => {
        const audioBlob = new Blob(['sample-audio'], { type: 'audio/wav' });
        const assetId = await saveAssetToStorage(audioBlob);

        expect(ref).toHaveBeenCalledWith(expect.anything(), `users/test-user-123/assets/${assetId}`);
        expect(uploadBytes).toHaveBeenCalledWith(
            expect.anything(),
            audioBlob,
            { contentType: 'audio/wav' }
        );
    });
});
