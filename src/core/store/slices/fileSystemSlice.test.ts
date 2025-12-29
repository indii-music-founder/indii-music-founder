
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileSystemSlice, FileSystemSlice } from './fileSystemSlice';
import { fileSystemService } from '@/services/FileSystemService';

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

describe('FileSystemSlice', () => {
    let mockSet: any;
    let mockGet: any;

    beforeEach(() => {
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
        const slice = createFileSystemSlice(mockSet, mockGet, {} as any);

        const mockNewNode = {
            id: 'new-file-id',
            name: 'test.html',
            type: 'file',
            fileType: 'document',
            parentId: null,
            projectId: 'p1',
            userId: 'u1',
            data: { url: 'http://test.com' }
        };

        (fileSystemService.createNode as any).mockResolvedValue(mockNewNode);

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
});
