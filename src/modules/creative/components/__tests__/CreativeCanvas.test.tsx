import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreativeCanvas from '../CreativeCanvas';
import React from 'react';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: () => ({
        updateHistoryItem: vi.fn(),
        setActiveReferenceImage: vi.fn(),
        uploadedImages: [],
        addUploadedImage: vi.fn(),
        currentProjectId: 'test-project'
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
// Mock Fabric.js
vi.mock('fabric', () => {
    const CanvasMock = vi.fn().mockImplementation(function (this: any) {
        return {
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

    const ImageMock = {
        fromURL: vi.fn().mockResolvedValue({
            scale: vi.fn(),
            set: vi.fn(),
            width: 100,
            height: 100
        })
    };

    const RectMock = vi.fn();
    const CircleMock = vi.fn();
    const ITextMock = vi.fn();
    const PencilBrushMock = vi.fn();

    return {
        Canvas: CanvasMock,
        Image: ImageMock,
        Rect: RectMock,
        Circle: CircleMock,
        IText: ITextMock,
        PencilBrush: PencilBrushMock,
    };
});

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

    it('should render canvas element', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('creative-canvas-element')).toBeInTheDocument();
    });

    it('should show Magic Fill input in the header', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('magic-fill-input')).toBeInTheDocument();
    });

    it('should enter Magic Edit mode when tool is toggled', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);

        // Toggle Magic Fill via sidebar toolbar
        const magicFillButton = screen.getByTitle('Magic Fill');
        fireEvent.click(magicFillButton);

        // Should show floating status (it's in the document)
        expect(screen.getByText(/Magic Edit Mode:/i)).toBeInTheDocument();
    });

    it('should show Magic Fill input and Refine button', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByPlaceholderText(/Magic Edit/i)).toBeInTheDocument();
        expect(screen.getByText('Refine')).toBeInTheDocument();
    });

    it('should show Animate button for images in preview mode', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByText('Animate')).toBeInTheDocument();
    });

    it('should NOT show Animate button for videos', () => {
        const videoItem = { ...mockItem, type: 'video' as const };
        render(<CreativeCanvas item={videoItem} onClose={mockOnClose} />);
        expect(screen.queryByText('Animate')).not.toBeInTheDocument();
    });
});
