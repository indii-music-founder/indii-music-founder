
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileSystemService, FileNode } from './FileSystemService';
import { deleteDoc, doc, writeBatch } from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
    return {
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
        getDoc: vi.fn(),
        setDoc: vi.fn(),
        onSnapshot: vi.fn(),
        writeBatch: vi.fn(() => ({
            delete: vi.fn(),
            commit: vi.fn()
        })),
        initializeFirestore: vi.fn(() => ({})),
        persistentLocalCache: vi.fn(),
        persistentMultipleTabManager: vi.fn(),
        Timestamp: {
            now: () => ({ toMillis: () => 1000 })
        }
    };
});

// Mock dependencies
vi.mock('./firebase', () => ({
    db: {}
}));

describe('FileSystemService Performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deleteFolderRecursive performs batched deletes (optimized)', async () => {
        const mockNodes: FileNode[] = [
            { id: 'folder1', parentId: null, type: 'folder', name: 'Root', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 },
            { id: 'file1', parentId: 'folder1', type: 'file', name: 'File 1', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 },
            { id: 'folder2', parentId: 'folder1', type: 'folder', name: 'Subfolder', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 },
            { id: 'file2', parentId: 'folder2', type: 'file', name: 'File 2', projectId: 'p1', userId: 'u1', createdAt: 0, updatedAt: 0 }
        ];

        // Setup spy for batch delete
        const batchDeleteSpy = vi.fn();
        const batchCommitSpy = vi.fn().mockResolvedValue(undefined);
        vi.mocked(writeBatch).mockReturnValue({
            delete: batchDeleteSpy,
            commit: batchCommitSpy,
            set: vi.fn(),
            update: vi.fn()
        } as any);

        await fileSystemService.deleteFolderRecursive('folder1', mockNodes);

        // Expect NO deleteDoc calls (replaced by batch)
        expect(deleteDoc).not.toHaveBeenCalled();

        // Expect 1 batch created
        expect(writeBatch).toHaveBeenCalledTimes(1);

        // Expect 4 delete operations in that batch (all unique nodes)
        expect(batchDeleteSpy).toHaveBeenCalledTimes(4);

        // Expect commit
        expect(batchCommitSpy).toHaveBeenCalledTimes(1);
    });
});
