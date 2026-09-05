import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectCanvas from '../ProjectCanvas';
import { useStore } from '@/core/store';
import type { ProjectCanvasBlock, ProjectCanvasDocument } from '../types';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user_123' } },
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    onSnapshot: vi.fn(() => () => {}),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
    serverTimestamp: vi.fn(() => 1700000000000),
}));

describe('ProjectCanvas Component', () => {
    const mockDocument: ProjectCanvasDocument = {
        id: 'canvas_proj_1',
        schemaVersion: 1,
        projectId: 'proj_1',
        ownerId: 'user_123',
        title: 'Project Canvas',
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        revision: 0,
        blockIds: ['block_text_1', 'block_asset_1'],
        edgeIds: [],
    };

    const mockTextBlock: ProjectCanvasBlock = {
        id: 'block_text_1',
        type: 'text',
        canvasId: 'canvas_proj_1',
        projectId: 'proj_1',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 },
        zIndex: 1,
        snapshot: {
            title: 'Creative Brief',
            excerpt: 'Futuristic pop aesthetics',
            cachedAt: 1700000000000,
        },
        settings: { content: 'Futuristic pop aesthetics' },
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
    };

    const mockAssetBlock: ProjectCanvasBlock = {
        id: 'block_asset_1',
        type: 'asset',
        canvasId: 'canvas_proj_1',
        projectId: 'proj_1',
        position: { x: 450, y: 100 },
        size: { width: 320, height: 260 },
        zIndex: 2,
        snapshot: {
            title: 'Album Cover',
            mediaType: 'image',
            thumbnailUrl: 'https://example.com/cover.png',
            cachedAt: 1700000000000,
        },
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        useStore.setState({
            currentProjectId: 'proj_1',
            currentCanvas: mockDocument,
            canvasBlocks: [mockTextBlock, mockAssetBlock],
            canvasEdges: [],
            selectedBlockIds: [],
            canvasViewport: { x: 0, y: 0, zoom: 1 },
            activeCanvasTool: 'select',
            isCanvasSaving: false,
            isCanvasDirty: false,
            canvasSaveError: null,
            canvasLastSavedAt: 1700000000000,
        });
    });

    it('renders the Project Canvas workspace with blocks, toolbar, and HUD', () => {
        render(<ProjectCanvas />);

        expect(screen.getByRole('application', { name: /Project Canvas/i })).toBeInTheDocument();
        expect(screen.getByText('Creative Brief')).toBeInTheDocument();
        expect(screen.getByText('Album Cover')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Select tool/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Pan tool/i })).toBeInTheDocument();
        expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('selects a block on click', () => {
        render(<ProjectCanvas />);

        const textCard = screen.getByRole('region', { name: /Text Block: Creative Brief/i });
        fireEvent.click(textCard);

        expect(useStore.getState().selectedBlockIds).toContain('block_text_1');
    });

    it('removes block placement when delete icon is clicked', () => {
        render(<ProjectCanvas />);

        const removeButtons = screen.getAllByRole('button', { name: /Remove placement from canvas/i });
        expect(removeButtons.length).toBeGreaterThanOrEqual(1);

        fireEvent.click(removeButtons[0]);

        const remainingBlocks = useStore.getState().canvasBlocks;
        expect(remainingBlocks.find((b) => b.id === 'block_text_1')).toBeUndefined();
    });

    it('updates zoom when zoom buttons in HUD are clicked', () => {
        render(<ProjectCanvas />);

        const zoomInBtn = screen.getByRole('button', { name: /Zoom in/i });
        fireEvent.click(zoomInBtn);

        expect(useStore.getState().canvasViewport.zoom).toBeGreaterThan(1);
    });

    it('adds a new text card when Text button in toolbar is clicked', () => {
        render(<ProjectCanvas />);

        const addTextBtn = screen.getByRole('button', { name: /Add text card/i });
        fireEvent.click(addTextBtn);

        const blocks = useStore.getState().canvasBlocks;
        expect(blocks.length).toBe(3);
    });
});
