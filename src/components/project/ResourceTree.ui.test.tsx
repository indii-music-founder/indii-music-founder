
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResourceTree } from './ResourceTree';
import { useStore } from '@/core/store';
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

describe('ResourceTree UI States', () => {
    const defaultStoreState = {
        currentProjectId: 'test-project',
        userProfile: { id: 'test-user' },
        fileNodes: [],
        fetchFileNodes: vi.fn(),
        expandedFolderIds: [],
        toggleFolder: vi.fn(),
        selectedFileNodeId: null,
        setSelectedFileNode: vi.fn(),
        createFolder: vi.fn(),
        deleteNode: vi.fn(),
        moveNode: vi.fn(),
        renameNode: vi.fn(),
        createFileNode: vi.fn(),
        isFileSystemLoading: false
    };

    it('displays loading spinner when isFileSystemLoading is true and no nodes', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultStoreState,
            isFileSystemLoading: true,
            fileNodes: []
        });

        const { container } = render(<ResourceTree />);
        // Expect Loader2 (animate-spin class)
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.queryByText(/No resources in this project/i)).not.toBeInTheDocument();
    });

    it('displays empty state when not loading and no nodes', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultStoreState,
            isFileSystemLoading: false,
            fileNodes: []
        });

        const { container } = render(<ResourceTree />);
        expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
        expect(screen.getByText(/No resources in this project/i)).toBeInTheDocument();
    });

    it('displays "No project selected" when currentProjectId is null', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultStoreState,
            currentProjectId: null
        });

        render(<ResourceTree />);
        expect(screen.getByText('No project selected')).toBeInTheDocument();
    });

    it('displays file nodes when loaded', () => {
        const mockFileNode = {
            id: 'node-1',
            name: 'test-file.png',
            type: 'file',
            parentId: null,
            fileType: 'image'
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultStoreState,
            isFileSystemLoading: false,
            fileNodes: [mockFileNode]
        });

        const { container } = render(<ResourceTree />);
        expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
        expect(screen.getByText('test-file.png')).toBeInTheDocument();
    });
});
