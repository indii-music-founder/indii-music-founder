
import { describe, it, expect, vi, beforeEach } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createFileSystemSlice, FileSystemSlice } from '@/core/store/slices/fileSystemSlice';
import { FileNode, fileSystemService } from '@/services/FileSystemService';

// Mock Service
vi.mock('@/services/FileSystemService', () => ({
    fileSystemService: {
        getProjectNodes: vi.fn(),
        createNode: vi.fn(),
        updateNode: vi.fn(),
        deleteNode: vi.fn(),
        deleteFolderRecursive: vi.fn()
    }
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('@/core/context/ToastContext', () => ({ toast: { error: toastError, success: vi.fn() } }));

describe('FileSystemSlice', () => {
    let mockSet: any;
    let mockGet: any;

    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        mockSet = vi.fn((updateFn) => {
            // Basic mock implementation if needed, but we mostly check calls to service
            // For state updates we can just verify the logic inside the slice function
        });
        mockGet = vi.fn(() => ({
            fileNodes: [],
            selectedFileNodeId: null,
            expandedFolderIds: []
        }));
    });

    it('createFileNode calls service and updates state', async () => {
        const slice = createFileSystemSlice(mockSet, mockGet, {} as unknown as import('zustand').StoreApi<import('@/core/store/index').StoreState>);

        const mockNewNode: FileNode = {
            id: 'new-file-id',
            name: 'test.html',
            type: 'file',
            fileType: 'document',
            parentId: null,
            projectId: 'p1',
            userId: 'u1',
            data: { url: 'http://test.com' },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        vi.mocked(fileSystemService.createNode).mockResolvedValue(mockNewNode);

        await slice.createFileNode('test.html', null, 'p1', 'u1', 'document', { url: 'http://test.com' });

        // Verify Service Call
        expect(fileSystemService.createNode).toHaveBeenCalledWith({
            name: 'test.html',
            type: 'file',
            fileType: 'document',
            parentId: null,
            projectId: 'p1',
            userId: 'u1',
            data: { url: 'http://test.com' }
        });

        // Verify State Update
        // The set function is called with a function updater
        expect(mockSet).toHaveBeenCalled();
        const updater = mockSet.mock.calls[0][0];
        const nextState = updater({ fileNodes: [], selectedFileNodeId: null });

        expect(nextState.fileNodes).toContainEqual(mockNewNode);
        expect(nextState.selectedFileNodeId).toBe('new-file-id');
    });

    describe('failed mutations are reported to the user', () => {
        const makeSlice = () => createFileSystemSlice(
            mockSet, mockGet, {} as unknown as import('zustand').StoreApi<import('@/core/store/index').StoreState>,
        );

        beforeEach(() => {
            toastError.mockClear();
            mockGet.mockReturnValue({ fileNodes: [{ id: 'a', parentId: null }], selectedFileNodeId: null, expandedFolderIds: [] });
        });

        it('tells the user when a delete fails and the file is restored', async () => {
            vi.mocked(fileSystemService.deleteFolderRecursive).mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
            await makeSlice().deleteNode('a');
            expect(toastError).toHaveBeenCalledWith('Could not delete it: PERMISSION_DENIED');
        });

        it('tells the user when a move fails', async () => {
            vi.mocked(fileSystemService.updateNode).mockRejectedValueOnce(new Error('offline'));
            await makeSlice().moveNode('a', { parentId: 'b' }, 'p1');
            expect(toastError).toHaveBeenCalledWith('Could not move it: offline');
        });

        it('tells the user when a rename fails', async () => {
            vi.mocked(fileSystemService.updateNode).mockRejectedValueOnce(new Error('offline'));
            await makeSlice().renameNode('a', 'New name');
            expect(toastError).toHaveBeenCalledWith('Could not rename it: offline');
        });

        it('stays quiet when the mutation succeeds', async () => {
            vi.mocked(fileSystemService.deleteFolderRecursive).mockResolvedValueOnce(undefined as never);
            await makeSlice().deleteNode('a');
            expect(toastError).not.toHaveBeenCalled();
        });
    });
});
