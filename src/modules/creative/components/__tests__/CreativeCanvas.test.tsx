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
        type: 'image' as const
    };

    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render nothing if item is null', () => {
        const { container } = render(<CreativeCanvas item={null} onClose={mockOnClose} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('should render image preview initially', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByAltText('test prompt')).toBeInTheDocument();
        expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('should switch to edit mode when "Edit in Canvas" is clicked', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);

        const editButton = screen.getByText('Edit in Canvas');
        fireEvent.click(editButton);

        expect(screen.getByText('Fabric.js Editor')).toBeInTheDocument();
        expect(screen.getByTitle('Magic Fill')).toBeInTheDocument();
    });

    it('should show Magic Fill UI when toggled', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit in Canvas'));

        // Toggle Magic Fill
        const magicFillButton = screen.getByTitle('Magic Fill');
        fireEvent.click(magicFillButton);

        expect(screen.getByPlaceholderText('Describe changes...')).toBeInTheDocument();
        expect(screen.getByText('Generate')).toBeInTheDocument();
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
