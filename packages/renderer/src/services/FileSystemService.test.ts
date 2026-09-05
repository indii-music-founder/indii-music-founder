
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileSystemService, FileNode } from './FileSystemService';
import { trashService } from './trash/TrashService';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
    return {
        serverTimestamp: vi.fn(),
        getFirestore: vi.fn(),
        collection: vi.fn(),
        doc: vi.fn(),
        addDoc: vi.fn(),
        updateDoc: vi.fn(),
        deleteDoc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        getDoc: vi.fn(async () => ({
            exists: () => true,
            data: () => ({ name: 'Test Item', userId: 'u1', type: 'file' }),
        })),
        setDoc: vi.fn(),
        onSnapshot: vi.fn(),
        writeBatch: vi.fn(() => ({
            serverTimestamp: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn()
        })),
        initializeFirestore: vi.fn(() => ({
            serverTimestamp: vi.fn(),
        })),
        persistentLocalCache: vi.fn(),
        persistentMultipleTabManager: vi.fn(),
        Timestamp: {
            now: () => ({
                serverTimestamp: vi.fn(), toMillis: () => 1000
            })
        }
    };
});

// Mock dependencies
vi.mock('./firebase', () => ({
    serverTimestamp: vi.fn(),
    db: {},
    auth: { currentUser: { uid: 'u1' } },
    functions: {},
}));

describe('FileSystemService Performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deleteFolderRecursive routes every node through reversible Trash', async () => {
        const mockNodes: FileNode[] = [
            { id: 'folder1', parentId: null, type: 'folder', name: 'Root', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 },
            { id: 'file1', parentId: 'folder1', type: 'file', name: 'File 1', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 },
            { id: 'folder2', parentId: 'folder1', type: 'folder', name: 'Subfolder', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 },
            { id: 'file2', parentId: 'folder2', type: 'file', name: 'File 2', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 }
        ];

        const mockMoveToTrash = vi.fn().mockResolvedValue({ id: 'trash-1' });
        vi.spyOn(trashService, 'moveToTrash').mockImplementation(mockMoveToTrash);

        await fileSystemService.deleteFolderRecursive('folder1', mockNodes);

        // Expect moveToTrash called for each item in the tree (4 items)
        expect(mockMoveToTrash).toHaveBeenCalledTimes(4);
    });

    it('sanitizes raw base64 data URIs from data.url before creating nodes to prevent Firestore indexing error', async () => {
        const mockAdd = vi.spyOn(fileSystemService as any, 'add').mockResolvedValue('new-node-id');

        const created = await fileSystemService.createNode({
            name: 'generation-test.png',
            type: 'file',
            fileType: 'image',
            parentId: null,
            projectId: 'p1',
            userId: 'u1',
            data: {
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                storagePath: 'users/u1/assets/test.png',
                origin: 'generated',
                mimeType: 'image/png'
            }
        });

        expect(mockAdd).toHaveBeenCalled();
        const addedPayload = mockAdd.mock.calls[0]![0] as { data: { url?: string; storagePath?: string } };
        // The raw data URI must be stripped to protect Firestore's 1500-byte embedded entity limit
        expect(addedPayload.data.url).toBeUndefined();
        expect(addedPayload.data.storagePath).toBe('users/u1/assets/test.png');
        expect(created.data?.url).toBeUndefined();
    });
});
