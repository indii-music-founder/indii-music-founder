import { describe, expect, it, vi } from 'vitest';
import { CanvasOperationsService } from '@/modules/creative/services/CanvasOperationsService';

describe('CanvasOperationsService.saveCanvasBlob (ISSUE-1708)', () => {
  it('exports flattened canvas directly via toCanvasElement + toBlob without base64 toDataURL conversion', async () => {
    const service = new CanvasOperationsService();
    const expectedBlob = new Blob(['png-bytes'], { type: 'image/png' });
    const toDataURL = vi.fn();
    const toBlob = vi.fn((cb: (value: Blob | null) => void) => cb(expectedBlob));
    const toCanvasElement = vi.fn(() => ({ toBlob } as unknown as HTMLCanvasElement));
    const renderAll = vi.fn();
    const annotation = { visible: true, data: { isAnnotation: true }, type: 'path' };

    (service as unknown as { canvas: unknown }).canvas = {
      getWidth: () => 800,
      getHeight: () => 800,
      getObjects: () => [annotation],
      viewportTransform: [1, 0, 0, 1, 0, 0],
      renderAll,
      toDataURL,
      toCanvasElement,
    };

    const blob = await service.saveCanvasBlob();

    expect(blob).toBe(expectedBlob);
    expect(toCanvasElement).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toDataURL).not.toHaveBeenCalled();
    // Annotation visibility must be restored after export
    expect(annotation.visible).toBe(true);
  });

  it('falls back cleanly to dataURL blob conversion when toCanvasElement is unavailable', async () => {
    const service = new CanvasOperationsService();
    const validPngBytes = new Uint8Array(256);
    validPngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngBase64 = `data:image/png;base64,${Buffer.from(validPngBytes).toString('base64')}`;
    const toDataURL = vi.fn(() => pngBase64);

    (service as unknown as { canvas: unknown }).canvas = {
      getWidth: () => 512,
      getHeight: () => 512,
      getObjects: () => [],
      getActiveObject: () => null,
      discardActiveObject: () => {},
      viewportTransform: [1, 0, 0, 1, 0, 0],
      renderAll: vi.fn(),
      toDataURL,
    };

    const blob = await service.saveCanvasBlob();

    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBeGreaterThanOrEqual(256);
    expect(toDataURL).toHaveBeenCalledTimes(1);
  });
});
