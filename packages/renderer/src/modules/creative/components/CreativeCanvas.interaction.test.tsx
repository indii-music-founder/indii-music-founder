import { render, screen, fireEvent } from '@/test/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeCanvas from './CreativeCanvas';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

import { createMockStore } from '@/test/utils';

// Mock dependencies
const defaultStoreState = createMockStore({
    updateHistoryItem: vi.fn(),
    setActiveReferenceImage: vi.fn(),
    uploadedImages: [],
    addUploadedImage: vi.fn(),
    currentProjectId: 'test-project',
    generatedHistory: [],
});

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => {
        if (typeof selector === 'function') {
            return selector(defaultStoreState);
        }
        return defaultStoreState;
    })
}));

vi.mock('fabric', () => ({
    Canvas: vi.fn().mockImplementation(() => ({
        dispose: vi.fn(), add: vi.fn(), renderAll: vi.fn(),
        getObjects: vi.fn().mockReturnValue([]), remove: vi.fn(),
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
        set: vi.fn(), isDrawingMode: false, freeDrawingBrush: {},
    })),
    Image: { fromURL: vi.fn().mockResolvedValue({ scale: vi.fn(), set: vi.fn(), width: 100, height: 100 }) },
    Rect: vi.fn(), Circle: vi.fn(), IText: vi.fn(), PencilBrush: vi.fn(),
}));
vi.mock('@/services/storage/repository', () => ({
    saveAssetToStorage: vi.fn(), saveCanvasStateToStorage: vi.fn(),
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
vi.mock('../services/VideoDirector', () => ({ VideoDirector: { triggerAnimation: vi.fn().mockResolvedValue({ success: true }) } }));
vi.mock('@/services/image/EditingService', () => ({ Editing: { magicFill: vi.fn() } }));

describe('🖱️ Click: Creative Studio Daisychain', () => {
    const mockItem = {
        id: '1', url: 'http://test.com/image.png', prompt: 'test prompt',
        type: 'image' as const, timestamp: Date.now(), projectId: 'test-project'
    };

    beforeEach(() => vi.clearAllMocks());

    it('renders canvas and allows interaction with core controls', () => {
        const onClose = vi.fn();
        render(<CreativeCanvas item={mockItem as any} onClose={onClose} />);

        // Canvas container renders
        expect(screen.getByTestId('creative-canvas-container')).toBeInTheDocument();

        // Magic Fill input is available
        const magicInput = screen.getByTestId('magic-fill-input');
        expect(magicInput).toBeInTheDocument();

        // Close button works
        const closeBtn = screen.getByTestId('canvas-close-btn');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });
});
