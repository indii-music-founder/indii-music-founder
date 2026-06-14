import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssetsPanel from './AssetsPanel';
import { useStore } from '@/core/store';

// Mock store
vi.mock('@/core/store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    (mockUseStore as any).getState = vi.fn(() => ({}));
    return { useStore: mockUseStore };
});

// Mock motion/react to avoid animation issues in JSDOM
vi.mock('motion/react', () => ({
    motion: {
        button: ({ children, ...props }: any) => {
            const cleanProps = { ...props };
            delete cleanProps.initial;
            delete cleanProps.animate;
            delete cleanProps.exit;
            delete cleanProps.transition;
            return <button {...cleanProps}>{children}</button>;
        }
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('AssetsPanel', () => {
    const mockToggleRightPanel = vi.fn();
    const mockSetSelectedItem = vi.fn();
    const mockSetViewMode = vi.fn();
    const mockSetModule = vi.fn();
    const mockRemoveItemFromProject = vi.fn();
    const mockRemoveUploadedImageFromProject = vi.fn();
    const mockRemoveUploadedAudioFromProject = vi.fn();
    const mockDeleteNode = vi.fn();

    const mockGeneratedHistory = [
        {
            id: 'gen-img-1',
            type: 'image' as const,
            url: 'https://example.com/gen-img-1.jpg',
            thumbnailUrl: 'https://example.com/gen-img-1-thumb.jpg',
            prompt: 'beautiful neon city sunset',
            timestamp: 1625097600000,
            projectId: 'test-project',
            origin: 'generated' as const,
        },
        {
            id: 'gen-vid-1',
            type: 'video' as const,
            url: 'https://example.com/gen-vid-1.mp4',
            thumbnailUrl: 'https://example.com/gen-vid-1-thumb.jpg',
            prompt: 'guitar performance vertical close-up',
            timestamp: 1625097800000,
            projectId: 'test-project',
            origin: 'generated' as const,
        }
    ];

    const mockUploadedImages = [
        {
            id: 'up-img-1',
            type: 'image' as const,
            url: 'https://example.com/up-img-1.jpg',
            thumbnailUrl: 'https://example.com/up-img-1.jpg',
            prompt: 'uploaded album art cover mockup',
            timestamp: 1625097400000,
            projectId: 'test-project',
            origin: 'uploaded' as const,
        }
    ];

    const mockUploadedAudio = [
        {
            id: 'up-aud-1',
            type: 'music' as const,
            url: 'https://example.com/up-aud-1.mp3',
            thumbnailUrl: '',
            prompt: 'synthesized bass stem hook',
            timestamp: 1625097500000,
            projectId: 'test-project',
            origin: 'uploaded' as const,
        }
    ];

    const mockFileNodes = [
        {
            id: 'file-node-1',
            type: 'file' as const,
            name: 'lyric_draft_v2.txt',
            updatedAt: 1625097700000,
            projectId: 'test-project',
            data: {
                url: 'https://example.com/lyric_draft_v2.txt',
                mimeType: 'text/plain',
            }
        }
    ];

    const defaultState = {
        generatedHistory: mockGeneratedHistory,
        uploadedImages: mockUploadedImages,
        uploadedAudio: mockUploadedAudio,
        fileNodes: mockFileNodes,
        setSelectedItem: mockSetSelectedItem,
        setViewMode: mockSetViewMode,
        setModule: mockSetModule,
        removeItemFromProject: mockRemoveItemFromProject,
        removeUploadedImageFromProject: mockRemoveUploadedImageFromProject,
        removeUploadedAudioFromProject: mockRemoveUploadedAudioFromProject,
        deleteNode: mockDeleteNode
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(defaultState);
            return defaultState;
        });
        (useStore as any).getState = () => defaultState;
    });

    it('renders placeholder empty state when there are no assets', () => {
        const emptyState = {
            ...defaultState,
            generatedHistory: [],
            uploadedImages: [],
            uploadedAudio: [],
            fileNodes: []
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(emptyState);
            return emptyState;
        });

        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);
        expect(screen.getByText('No assets yet')).toBeInTheDocument();
        expect(screen.getByText('Generate images, upload files, or record audio to see them here.')).toBeInTheDocument();
    });

    it('renders assets correctly in Grid view with filter counts', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);

        // Verify Title and total count badge
        expect(screen.getByText('Project Assets')).toBeInTheDocument();
        
        // Verify filter tab badges and counts
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('Images')).toBeInTheDocument();
        expect(screen.getByText('Videos')).toBeInTheDocument();
        expect(screen.getByText('Audio')).toBeInTheDocument();
        expect(screen.getByText('Files')).toBeInTheDocument();

        // 2 generated items + 1 uploaded img + 1 uploaded audio + 1 file node = 5 total assets
        // Let's verify grid items render (hover prompt texts are rendered)
        expect(screen.getByText('beautiful neon city sunset')).toBeInTheDocument();
        expect(screen.getByText('guitar performance vertical close-up')).toBeInTheDocument();
        expect(screen.getByText('uploaded album art cover mockup')).toBeInTheDocument();
        expect(screen.getByText('synthesized bass stem hook')).toBeInTheDocument();
        expect(screen.getByText('lyric_draft_v2.txt')).toBeInTheDocument();
    });

    it('toggles between Grid view and List view styles', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);

        // Grid mode is default, let's toggle to List mode
        const viewToggleBtn = screen.getByTitle('List view');
        fireEvent.click(viewToggleBtn);

        // Under List view, dates and types are printed as text
        expect(screen.getAllByText('image')[0]).toBeInTheDocument();
        expect(screen.getByText('video')).toBeInTheDocument();
        expect(screen.getByText('music')).toBeInTheDocument();
        expect(screen.getByText('text')).toBeInTheDocument();

        // Let's toggle back to Grid mode
        const gridToggleBtn = screen.getByTitle('Grid view');
        fireEvent.click(gridToggleBtn);
        expect(screen.queryByText('video')).not.toBeInTheDocument();
    });

    it('closes the right panel when close chevron is clicked', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        const closeBtn = screen.getByLabelText('Close Panel');
        fireEvent.click(closeBtn);
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('searches and filters assets by query input', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);

        const searchInput = screen.getByPlaceholderText('Search assets...');
        fireEvent.change(searchInput, { target: { value: 'sunset' } });

        // 'sunset' should match 'beautiful neon city sunset'
        expect(screen.getByText('beautiful neon city sunset')).toBeInTheDocument();
        // others should be hidden
        expect(screen.queryByText('guitar performance vertical close-up')).not.toBeInTheDocument();
    });

    it('filters assets by category button clicks', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);

        // Click Images filter
        const imagesFilterBtn = screen.getByText('Images');
        fireEvent.click(imagesFilterBtn);

        // Images prompt should be visible
        expect(screen.getByText('beautiful neon city sunset')).toBeInTheDocument();
        expect(screen.getByText('uploaded album art cover mockup')).toBeInTheDocument();
        // Videos and Audio should be hidden
        expect(screen.queryByText('guitar performance vertical close-up')).not.toBeInTheDocument();
        expect(screen.queryByText('synthesized bass stem hook')).not.toBeInTheDocument();

        // Click Videos filter
        const videosFilterBtn = screen.getByText('Videos');
        fireEvent.click(videosFilterBtn);
        expect(screen.getByText('guitar performance vertical close-up')).toBeInTheDocument();
        expect(screen.queryByText('beautiful neon city sunset')).not.toBeInTheDocument();
    });

    it('triggers selection callbacks on asset click', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);

        // Click the first asset (generated image)
        const imageAsset = screen.getByText('beautiful neon city sunset').closest('button');
        expect(imageAsset).toBeInTheDocument();
        fireEvent.click(imageAsset!);

        expect(mockSetSelectedItem).toHaveBeenCalledWith(mockGeneratedHistory[0]);
        expect(mockSetModule).toHaveBeenCalledWith('creative');
        expect(mockSetViewMode).toHaveBeenCalledWith('editor');
    });

    it('deletes different types of assets through correct store handlers', () => {
        render(<AssetsPanel toggleRightPanel={mockToggleRightPanel} />);

        // 1. Delete generated video
        const deleteGenVidBtn = screen.getAllByTitle('Remove from project')[0];
        fireEvent.click(deleteGenVidBtn);
        expect(mockRemoveItemFromProject).toHaveBeenCalledWith('gen-vid-1');

        // 2. Delete file node
        const deleteFileNodeBtn = screen.getAllByTitle('Remove from project')[1];
        fireEvent.click(deleteFileNodeBtn);
        expect(mockDeleteNode).toHaveBeenCalledWith('file-node-1');

        // 3. Delete generated image
        const deleteGenImgBtn = screen.getAllByTitle('Remove from project')[2];
        fireEvent.click(deleteGenImgBtn);
        expect(mockRemoveItemFromProject).toHaveBeenCalledWith('gen-img-1');

        // 4. Delete uploaded audio
        const deleteUpAudioBtn = screen.getAllByTitle('Remove from project')[3];
        fireEvent.click(deleteUpAudioBtn);
        expect(mockRemoveUploadedAudioFromProject).toHaveBeenCalledWith('up-aud-1');

        // 5. Delete uploaded image
        const deleteUpImageBtn = screen.getAllByTitle('Remove from project')[4];
        fireEvent.click(deleteUpImageBtn);
        expect(mockRemoveUploadedImageFromProject).toHaveBeenCalledWith('up-img-1');
    });
});
