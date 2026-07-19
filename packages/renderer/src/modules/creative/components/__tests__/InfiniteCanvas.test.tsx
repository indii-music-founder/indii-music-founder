import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import InfiniteCanvas from '../InfiniteCanvas';
import React, { act } from 'react';

// Mock the store
const mockUseStore = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: (...args: any[]) => mockUseStore(...args),
}));

// Mock services to prevent errors
import { ImageGeneration } from '@/services/image/ImageGenerationService';
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: vi.fn() }
}));
vi.mock('@/services/image/EditingService', () => ({
    Editing: { editImage: vi.fn() }
}));
const mockDetectObjects = vi.fn();
vi.mock('@/services/image/ImageAnalysisService', () => ({
    imageAnalysisService: {
        detectObjects: (...args: any[]) => mockDetectObjects(...args),
    }
}));

const mockToast = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
};
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast
}));

describe('InfiniteCanvas Culling', () => {
    let mockContext: any;

    beforeEach(() => {
        mockDetectObjects.mockReset();
        mockToast.error.mockReset();
        mockToast.success.mockReset();
        mockToast.info.mockReset();
        mockToast.warning.mockReset();

        // Mock Canvas context
        mockContext = {
            fillStyle: '',
            fillRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            drawImage: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            strokeRect: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn(() => ({ width: 80 })),
            setLineDash: vi.fn(),
        };

        // Mock HTMLCanvasElement.getContext
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type: string) => {
            if (type === '2d') return mockContext;
            return null;
        });

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,canvas-data');

        // Mock window.Image
        global.Image = class {
            onload: any;
            src: string = '';
            width: number = 100;
            height: number = 100;
            naturalWidth: number = 100;
            complete: boolean = true;
            constructor() {
                setTimeout(() => this.onload && this.onload(), 0);
            }
        } as any;

        // Setup default store state
        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: [],
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage: vi.fn(),
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'test-project',
                generatedHistory: [],
                uploadedImages: [],
                failedVariationBatch: null,
                setFailedVariationBatch: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        // Mock requestAnimationFrame to run synchronously
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 0;
        });

        // Mock window dimensions
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should draw visible images', async () => {
        const visibleImage = {
            id: 'img1',
            base64: 'data:image/png;base64,1',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'p1'
        };

        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: [visibleImage],
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage: vi.fn(),
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'p1',
                generatedHistory: [],
                uploadedImages: [],
                failedVariationBatch: null,
                setFailedVariationBatch: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<InfiniteCanvas />);
        await new Promise(r => setTimeout(r, 10)); // Wait for image load

        // Verify drawImage called for 0,0
        const calls = mockContext.drawImage.mock.calls;
        const visibleCalls = calls.filter((args: any) => args[1] === 0 && args[2] === 0);
        expect(visibleCalls.length).toBeGreaterThan(0);
    });

    it('should NOT draw off-screen images', async () => {
        const visibleImage = {
            id: 'visible',
            base64: 'data:image/png;base64,1',
            x: 100,
            y: 100,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'p1'
        };

        const offScreenImage = {
            id: 'offscreen',
            base64: 'data:image/png;base64,2',
            x: 2000,
            y: 2000,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'p1'
        };

        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: [visibleImage, offScreenImage],
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage: vi.fn(),
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'p1',
                generatedHistory: [],
                uploadedImages: [],
                failedVariationBatch: null,
                setFailedVariationBatch: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<InfiniteCanvas />);
        await new Promise(r => setTimeout(r, 10));

        const calls = mockContext.drawImage.mock.calls;

        const visibleCalls = calls.filter((args: any) => args[1] === 100 && args[2] === 100);
        const offScreenCalls = calls.filter((args: any) => args[1] === 2000 && args[2] === 2000);

        // Visible should be drawn
        expect(visibleCalls.length).toBeGreaterThan(0);

        // Offscreen should NOT be drawn (this expectation will fail before optimization)
        expect(offScreenCalls.length).toBe(0);
    });

    it('runs real object detection and renders bounding boxes', async () => {
        const visibleImage = {
            id: 'img1',
            base64: 'data:image/png;base64,1',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'p1'
        };

        mockDetectObjects.mockResolvedValueOnce([
            {
                label: 'face',
                box: { xmin: 100, ymin: 120, xmax: 300, ymax: 420 }
            }
        ]);

        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: [visibleImage],
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage: vi.fn(),
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'p1',
                generatedHistory: [],
                uploadedImages: [],
                failedVariationBatch: null,
                setFailedVariationBatch: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<InfiniteCanvas />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Detect Objects/i }));
        });

        await waitFor(() => {
            expect(mockDetectObjects).toHaveBeenCalledOnce();
            expect(mockDetectObjects).toHaveBeenCalledWith('data:image/png;base64,1');
            expect(mockToast.success).toHaveBeenCalledWith('Detected 1 object.');
        });

        const overlayCalls = mockContext.strokeRect.mock.calls.filter((args: any[]) =>
            args[0] === 10 && args[1] === 12 && args[2] === 20 && args[3] === 30
        );
        expect(overlayCalls.length).toBeGreaterThan(0);
    });

    it('preserves every source layer when one layer is not ready to flatten', () => {
        const removeCanvasImage = vi.fn();
        const images = [
            { id: 'ready-layer', base64: 'data:image/png;base64,ready', x: 0, y: 0, width: 100, height: 100, aspect: 1, projectId: 'p1' },
            { id: 'pending-layer', base64: 'data:image/png;base64,pending', x: 100, y: 0, width: 100, height: 100, aspect: 1, projectId: 'p1' },
        ];

        global.Image = class {
            onload: (() => void) | null = null;
            naturalWidth = 0;
            complete = false;
            width = 100;
            height = 100;
            set src(_value: string) {}
        } as any;

        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: images,
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage,
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'p1',
                generatedHistory: [],
                uploadedImages: [],
                failedVariationBatch: null,
                setFailedVariationBatch: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<InfiniteCanvas />);
        fireEvent.click(screen.getByRole('button', { name: 'Flatten Canvas' }));

        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('still loading or unavailable'));
        expect(removeCanvasImage).not.toHaveBeenCalled();
    });

    it('aborts flatten if pre-flatten snapshot save fails', async () => {
        const saveDesignVersion = vi.fn().mockRejectedValue(new Error('Network error'));
        const removeCanvasImage = vi.fn();
        
        const images = [
            { id: 'layer1', base64: 'data:image/png;base64,1', x: 0, y: 0, width: 100, height: 100, aspect: 1, projectId: 'p1' },
            { id: 'layer2', base64: 'data:image/png;base64,2', x: 50, y: 50, width: 100, height: 100, aspect: 1, projectId: 'p1' },
        ];

        global.Image = class {
            onload: (() => void) | null = null;
            naturalWidth = 100;
            complete = true;
            width = 100;
            height = 100;
            set src(_value: string) {}
        } as any;

        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: images,
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage,
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'p1',
                generatedHistory: [],
                uploadedImages: [],
                saveDesignVersion,
                failedVariationBatch: null,
                setFailedVariationBatch: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<InfiniteCanvas />);
        fireEvent.click(screen.getByRole('button', { name: 'Flatten Canvas' }));

        await waitFor(() => {
            expect(saveDesignVersion).toHaveBeenCalled();
            expect(mockToast.error).toHaveBeenCalledWith('Flatten was not performed because its recovery revision could not be saved.');
            expect(removeCanvasImage).not.toHaveBeenCalled();
        });
    });

    it('displays failed variation batch UI and allows retry', async () => {
        const setFailedVariationBatch = vi.fn();
        const failedBatch = {
            source: { id: 'img1', base64: 'data:image/png;base64,1', x: 0, y: 0, width: 100, height: 100, aspect: 1, projectId: 'p1' },
            prompt: 'Test prompt',
            mimeType: 'image/png',
            base64Data: 'base64,1',
            projectId: 'p1',
            slots: [1, 2] // slots 1 and 2 failed
        };

        mockUseStore.mockImplementation((selector: any) => {
            const state = {
                canvasImages: [failedBatch.source],
                addCanvasImage: vi.fn(),
                updateCanvasImage: vi.fn(),
                removeCanvasImage: vi.fn(),
                selectedCanvasImageId: null,
                selectCanvasImage: vi.fn(),
                currentProjectId: 'p1',
                generatedHistory: [],
                uploadedImages: [],
                failedVariationBatch: failedBatch,
                setFailedVariationBatch,
                addToHistory: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<InfiniteCanvas />);

        // The button should be visible
        const resumeBtn = screen.getByRole('button', { name: /Retry Failed Variations/i });
        expect(resumeBtn).toBeInTheDocument();
        expect(resumeBtn).toHaveTextContent(/Retry 2 failed/i);
        
        // Mock successful generation for the retry
        (ImageGeneration.generateImages as any).mockResolvedValue([{ id: 'gen1', url: 'data:image/png;base64,new' }]);

        fireEvent.click(resumeBtn);

        await waitFor(() => {
            // Check if generateImages was called
            expect(ImageGeneration.generateImages).toHaveBeenCalled();
            // It should try to resume and immediately clear the batch (since it processes it)
            expect(setFailedVariationBatch).toHaveBeenCalledWith(null);
        });
    });
});
