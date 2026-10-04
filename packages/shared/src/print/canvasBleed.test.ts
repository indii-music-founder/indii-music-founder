import { describe, it, expect, vi } from 'vitest';
import { calculateCoverBox, drawBleedMirror, drawGuideOverlay, type Canvas2DContextLike } from './canvasBleed';

describe('canvasBleed Geometry & Math', () => {
    describe('calculateCoverBox', () => {
        it('calculates 1:1 box from rectangular image centered at (0.5, 0.5)', () => {
            const crop = calculateCoverBox(1920, 1080, 1000, 1000, 0.5, 0.5);
            expect(crop.width).toBe(1080);
            expect(crop.height).toBe(1080);
            expect(crop.x0).toBe((1920 - 1080) / 2); // 420
            expect(crop.y0).toBe(0);
            expect(crop.x1).toBe(420 + 1080);
            expect(crop.y1).toBe(1080);
        });

        it('respects focal X shift clamping', () => {
            // Shift to extreme left
            const leftCrop = calculateCoverBox(2000, 1000, 1000, 1000, 0.1, 0.5);
            expect(leftCrop.x0).toBe(0); // clamped at 0
            expect(leftCrop.width).toBe(1000);

            // Shift to extreme right
            const rightCrop = calculateCoverBox(2000, 1000, 1000, 1000, 0.95, 0.5);
            expect(rightCrop.x0).toBe(1000); // clamped at srcWidth - boxW
            expect(rightCrop.width).toBe(1000);
        });

        it('adapts square 1024 to 18x24 poster aspect ratio (3:4)', () => {
            const crop = calculateCoverBox(1024, 1024, 18, 24, 0.5, 0.5);
            // 3:4 aspect ratio => width is 1024 * (18/24) = 768
            expect(crop.height).toBe(1024);
            expect(crop.width).toBe(768);
            expect(crop.x0).toBe((1024 - 768) / 2); // 128
        });
    });

    describe('drawBleedMirror', () => {
        it('executes 9 drawImage calls with correct matrix transformations', () => {
            const drawCalls: any[] = [];
            const mockCtx: Canvas2DContextLike = {
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                scale: vi.fn(),
                drawImage: vi.fn((...args: any[]) => {
                    drawCalls.push(args);
                }),
            };

            const mockImage = { width: 1000, height: 1000 };
            drawBleedMirror(mockCtx, mockImage, 1000, 1000, 38);

            // 1 center + 4 edges + 4 corners = 9 drawImage calls
            expect(drawCalls.length).toBe(9);
            expect(mockCtx.save).toHaveBeenCalledTimes(8);
            expect(mockCtx.restore).toHaveBeenCalledTimes(8);

            // First call is center artwork placed at offset (38, 38)
            expect(drawCalls[0]).toEqual([mockImage, 0, 0, 1000, 1000, 38, 38, 1000, 1000]);

            // Second call is left border mirror: samples sx=1, sw=38
            expect(drawCalls[1]).toEqual([mockImage, 1, 0, 38, 1000, 0, 0, 38, 1000]);

            // Third call is right border mirror: samples sx=1000 - 1 - 38 = 961
            expect(drawCalls[2]).toEqual([mockImage, 961, 0, 38, 1000, -38, 0, 38, 1000]);
        });

        it('draws single image directly when bleedPx is 0', () => {
            const drawCalls: any[] = [];
            const mockCtx: Canvas2DContextLike = {
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                scale: vi.fn(),
                drawImage: vi.fn((...args: any[]) => {
                    drawCalls.push(args);
                }),
            };

            drawBleedMirror(mockCtx, {}, 1000, 1000, 0);
            expect(drawCalls.length).toBe(1);
            expect(mockCtx.save).not.toHaveBeenCalled();
        });
    });

    describe('drawGuideOverlay', () => {
        it('strokes red trim and green safe zone rectangles', () => {
            const strokeRectMock = vi.fn();
            const mockCtx: Canvas2DContextLike = {
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                scale: vi.fn(),
                drawImage: vi.fn(),
                strokeRect: strokeRectMock,
            };

            drawGuideOverlay(mockCtx, 3076, 3076, 38, 75);

            expect(strokeRectMock).toHaveBeenCalledTimes(2);
            // Trim rect: x=38, y=38, w=3076-76=3000, h=3000
            expect(strokeRectMock).toHaveBeenNthCalledWith(1, 38, 38, 3000, 3000);
            // Safe rect: x=113, y=113, w=3076-226=2850, h=2850
            expect(strokeRectMock).toHaveBeenNthCalledWith(2, 113, 113, 2850, 2850);
        });
    });
});
