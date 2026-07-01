import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CreativeCanvas from '../CreativeCanvas';
import React from 'react';
import { canvasOps } from '../../services/CanvasOperationsService';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: () => ({
        updateHistoryItem: vi.fn(),
        setActiveReferenceImage: vi.fn(),
        uploadedImages: [],
        addUploadedImage: vi.fn(),
        currentProjectId: 'test-project',
        generatedHistory: [],
        studioControls: {
            aspectRatio: '1:1',
            imageSize: '1k',
            model: 'fast',
            resolution: '1k',
            useGrounding: false,
        },
        initializeDesignHistory: vi.fn().mockResolvedValue(undefined)
    })
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    })
}));

// Mock Fabric.js
vi.mock('fabric', () => {
    const CanvasMock = vi.fn().mockImplementation(function (this: any) {
        return {
            on: vi.fn(),
            off: vi.fn(),
            dispose: vi.fn(),
            add: vi.fn(),
            renderAll: vi.fn(),
            getObjects: vi.fn().mockReturnValue([]),
            remove: vi.fn(),
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
            set: vi.fn(),
            toJSON: vi.fn().mockReturnValue({}),
            isDrawingMode: false,
            freeDrawingBrush: {},
        };
    });

    return {
        Canvas: CanvasMock,
        Image: { fromURL: vi.fn().mockResolvedValue({ scale: vi.fn(), set: vi.fn(), width: 100, height: 100 }) },
        Rect: vi.fn(),
        Circle: vi.fn(),
        IText: vi.fn(),
        PencilBrush: vi.fn(),
    };
});

vi.mock('@/services/storage/repository', () => ({
    saveAssetToStorage: vi.fn(),
    saveCanvasStateToStorage: vi.fn(),
    getCanvasStateFromStorage: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((url: string) => Promise.resolve(url)),
}));

vi.mock('@/services/creative/CreativeSessionService', () => ({
    creativeSessionService: {
        loadSession: vi.fn().mockResolvedValue(null),
        upsertFromManifest: vi.fn().mockResolvedValue(undefined),
        updateSession: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../services/CanvasOperationsService', () => ({
    canvasOps: {
        addRectangle: vi.fn(),
        addCircle: vi.fn(),
        addText: vi.fn(),
        initialize: vi.fn(),
        dispose: vi.fn(),
        updateBrushColor: vi.fn(),
        setMagicFillMode: vi.fn(),
        canUndo: vi.fn().mockReturnValue(false),
        canRedo: vi.fn().mockReturnValue(false),
        toJSON: vi.fn().mockResolvedValue({}),
        ensureBaseImage: vi.fn().mockResolvedValue(false),
        getLayers: vi.fn().mockReturnValue([]),
        selectLayer: vi.fn(),
        toggleLayerVisibility: vi.fn(),
        toggleLayerLock: vi.fn(),
        deleteLayer: vi.fn(),
        reorderLayer: vi.fn(),
    }
}));

vi.mock('../services/VideoDirector', () => ({
    VideoDirector: { triggerAnimation: vi.fn().mockResolvedValue({ success: true }) }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: { magicFill: vi.fn() }
}));

describe('CreativeCanvas', () => {
    const mockItem = {
        id: '1',
        url: 'http://test.com/image.png',
        prompt: 'test prompt',
        type: 'image' as const,
        timestamp: Date.now(),
        projectId: 'test-project'
    };

    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveStorageUrl).mockImplementation((url: string) => Promise.resolve(url));
    });

    it('should render nothing if item is null', () => {
        const { container } = render(<CreativeCanvas item={null} onClose={mockOnClose} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('should render canvas container when item is provided', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('creative-canvas-container')).toBeInTheDocument();
    });

    it('loads the thumbnail when the canonical image URL cannot resolve for editing', async () => {
        vi.mocked(resolveStorageUrl).mockImplementation((url: string) => {
            if (url === 'gs://mock-bucket/missing-full.png') {
                return Promise.resolve('gs://mock-bucket/missing-full.png');
            }
            return Promise.resolve(url);
        });

        render(
            <CreativeCanvas
                item={{
                    ...mockItem,
                    url: 'gs://mock-bucket/missing-full.png',
                    thumbnailUrl: 'https://cdn.example.com/thumb.png',
                }}
                onClose={mockOnClose}
            />
        );

        await waitFor(() => {
            expect(canvasOps.initialize).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                'https://cdn.example.com/thumb.png',
                undefined,
                expect.any(Function)
            );
        });
    });

    it('should render the magic fill input', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('magic-fill-input')).toBeInTheDocument();
    });

    it('should show Animate button for images', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('animate-btn')).toBeInTheDocument();
    });

    it('should show close button', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('canvas-close-btn')).toBeInTheDocument();
    });
});
