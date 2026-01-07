import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import InfiniteCanvas from '../InfiniteCanvas';
import React from 'react';

// Mock the store
const mockUseStore = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: (...args: any[]) => mockUseStore(...args),
}));

// Mock services to prevent errors
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: vi.fn() }
}));
vi.mock('@/services/image/EditingService', () => ({
    Editing: { editImage: vi.fn() }
}));

describe('InfiniteCanvas Culling', () => {
    let mockContext: any;

    beforeEach(() => {
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
            setLineDash: vi.fn(),
        };

        // Mock HTMLCanvasElement.getContext
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type: string) => {
            if (type === '2d') return mockContext;
            return null;
        });

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
                uploadedImages: []
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
                uploadedImages: []
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
                uploadedImages: []
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
});
