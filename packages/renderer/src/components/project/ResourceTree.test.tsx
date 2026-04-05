
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { ResourceTree } from './ResourceTree';
import { useStore } from '@/core/store';
import { StorageService } from '@/services/StorageService';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/services/StorageService');
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        loading: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        dismiss: vi.fn(),
    })
}));

describe('ResourceTree File Upload', () => {
    const mockCreateFileNode = vi.fn();
    const mockUploadFile = vi.fn();
    const mockFetchFileNodes = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock Store State
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentProjectId: 'test-project',
            userProfile: { id: 'test-user' },
            fileNodes: [],
            fetchFileNodes: mockFetchFileNodes,
            expandedFolderIds: [],
            toggleFolder: vi.fn(),
            selectedFileNodeId: null,
            setSelectedFileNode: vi.fn(),
            createFolder: vi.fn(),
            deleteNode: vi.fn(),
            moveNode: vi.fn(),
            renameNode: vi.fn(),
            createFileNode: mockCreateFileNode,
            isFileSystemLoading: false
        });

        // Mock Storage Service
        StorageService.uploadFile = mockUploadFile;
        mockUploadFile.mockResolvedValue('https://mock-download-url.com/file.png');
    });

    it('uploads a file successfully when dropped', async () => {
        const { container } = render(<ResourceTree />);

        const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
        const dropZone = container.querySelector('.custom-scrollbar') as HTMLElement; // Based on class in ResourceTree

        // Mock DataTransfer
        const dataTransfer = {
            files: [file],
            types: ['Files'],
            getData: vi.fn().mockReturnValue(''),
            setData: vi.fn(),
            effectAllowed: 'move',
            dropEffect: 'move'
        };

        // Trigger Drop
        fireEvent.drop(dropZone, {
            dataTransfer: dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        });

        await waitFor(() => {
            // Verify Storage Service call
            expect(mockUploadFile).toHaveBeenCalledTimes(1);
            expect(mockUploadFile).toHaveBeenCalledWith(
                file,
                expect.stringMatching(/projects\/test-project\/test-user\/.*_test.png/)
            );

            // Verify File Node Creation
            expect(mockCreateFileNode).toHaveBeenCalledWith(
                'test.png',
                null, // Parent ID
                'test-project',
                'test-user',
                'image',
                expect.objectContaining({
                    url: 'https://mock-download-url.com/file.png',
                    size: file.size,
                    mimeType: 'image/png'
                })
            );
        });
    });
});
