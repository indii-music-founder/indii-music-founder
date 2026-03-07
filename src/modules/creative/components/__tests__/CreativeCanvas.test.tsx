import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CreativeCanvas from '../CreativeCanvas';
import React from 'react';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: () => ({
        updateHistoryItem: vi.fn(),
        setActiveReferenceImage: vi.fn(),
        uploadedImages: [],
        addUploadedImage: vi.fn(),
        currentProjectId: 'test-project',
        generatedHistory: []
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

vi.mock('../services/CanvasOperationsService', () => ({
    canvasOps: {
        addRectangle: vi.fn(),
        addCircle: vi.fn(),
        addText: vi.fn(),
        initialize: vi.fn(),
        dispose: vi.fn(),
        updateBrushColor: vi.fn(),
        setMagicFillMode: vi.fn()
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
    });

    it('should render nothing if item is null', () => {
        const { container } = render(<CreativeCanvas item={null} onClose={mockOnClose} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('should render canvas container when item is provided', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('creative-canvas-container')).toBeInTheDocument();
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
