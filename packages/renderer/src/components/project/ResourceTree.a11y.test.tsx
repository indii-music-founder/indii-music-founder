import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceTree } from './ResourceTree';
import { useStore } from '@/core/store';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

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

describe('ResourceTree Accessibility', () => {
    const mockFileNodes = [
        {
            id: 'root-folder-1',
            name: 'Documents',
            type: 'folder',
            parentId: null,
            fileType: 'document',
        },
        {
            id: 'file-1',
            name: 'Resume.pdf',
            type: 'file',
            parentId: 'root-folder-1',
            fileType: 'document',
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentProjectId: 'test-project',
            userProfile: { id: 'test-user' },
            fileNodes: mockFileNodes,
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
        });
    });

    it('should have no accessibility violations', async () => {
        const { container } = render(<ResourceTree />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should have correct ARIA attributes', () => {
        render(<ResourceTree />);

        const tree = screen.getByRole('tree');
        expect(tree).toBeInTheDocument();

        // Initially only root node is visible because 'Documents' is collapsed
        const treeItems = screen.getAllByRole('treeitem');
        expect(treeItems).toHaveLength(1);

        const folderNode = screen.getByRole('treeitem', { name: 'Documents' });
        expect(folderNode).toHaveAttribute('aria-expanded', 'false');
        expect(folderNode).toHaveAttribute('tabIndex', '0');
    });

    it('should handle keyboard navigation for folders', async () => {
        const toggleFolderMock = vi.fn();
        const setSelectedFileNodeMock = vi.fn();

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentProjectId: 'test-project',
            userProfile: { id: 'test-user' },
            fileNodes: mockFileNodes,
            fetchFileNodes: vi.fn(),
            expandedFolderIds: [], // 'Documents' is collapsed
            toggleFolder: toggleFolderMock,
            selectedFileNodeId: null,
            setSelectedFileNode: setSelectedFileNodeMock,
            createFolder: vi.fn(),
            deleteNode: vi.fn(),
            moveNode: vi.fn(),
            renameNode: vi.fn(),
            createFileNode: vi.fn(),
            isFileSystemLoading: false
        });

        render(<ResourceTree />);

        const folderNode = screen.getByRole('treeitem', { name: 'Documents' });
        expect(folderNode).toHaveAttribute('tabIndex', '0');
        expect(folderNode).toHaveAttribute('aria-expanded', 'false');

        // Focus and press Enter
        folderNode.focus();
        fireEvent.keyDown(folderNode, { key: 'Enter', code: 'Enter' });

        expect(toggleFolderMock).toHaveBeenCalledWith('root-folder-1');
        expect(setSelectedFileNodeMock).toHaveBeenCalledWith('root-folder-1');
    });

    it('should have accessible action buttons', () => {
        render(<ResourceTree />);

        expect(screen.getByRole('button', { name: 'Upload File' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New Folder' })).toBeInTheDocument();

        const optionsButton = screen.getByRole('button', { name: 'Options for Documents' });
        expect(optionsButton).toBeInTheDocument();
    });
});
