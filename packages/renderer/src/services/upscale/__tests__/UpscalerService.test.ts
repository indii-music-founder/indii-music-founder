/**
 * UpscalerService tests (ISSUE-323).
 *
 * STRUCTURAL-ONLY: the bridge here is a fake. Per REAL_USER_AUTHENTICITY.md
 * these tests prove facade routing/fallback contracts, never the real
 * customer upscale path — that requires the real desktop engine run.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    UpscalerService,
    type UpscaleBridge,
    type UpscaleModel,
} from '../UpscalerService';

function makeBridge(overrides: Partial<UpscaleBridge> = {}): UpscaleBridge & { runMock: ReturnType<typeof vi.fn> } {
    const runMock = vi.fn(async (_req: { requestId: string; dataUrl: string; scale: 2 | 4; model?: string }) => ({
        outputDataUrl: 'data:image/png;base64,Tk9UQVJFQUxJTUFHUQ==',
        durationMs: 1234,
    }));
    const bridge: UpscaleBridge = {
        ensureEngine: vi.fn(async () => ({ enginePath: '/eng', version: 'v0.2.5.0', fromCache: true })),
        probe: vi.fn(async () => ({ enginePresent: true, gpuReady: true, detail: 'ok' })),
        run: runMock,
        onProgress: vi.fn(() => () => {}),
        ...overrides,
    };
    return { ...bridge, runMock };
}

describe('UpscalerService — routing and fallback (structural)', () => {
    it('throws no-electron outside the desktop bridge', async () => {
        const svc = new UpscalerService();
        svc.configure(null);
        await expect(svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 2 }))
            .rejects.toMatchObject({ reason: 'no-electron' });
    });

    it('throws provision-failed when the engine cannot be provisioned', async () => {
        const svc = new UpscalerService();
        svc.configure(makeBridge({
            ensureEngine: vi.fn(async () => { throw new Error('sha256 mismatch'); }),
        }));
        await expect(svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 2 }))
            .rejects.toMatchObject({ reason: 'provision-failed' });
    });

    it('throws gpu-not-ready when the probe reports no healthy GPU path', async () => {
        const svc = new UpscalerService();
        svc.configure(makeBridge({
            probe: vi.fn(async () => ({ enginePresent: true, gpuReady: false, detail: 'vkEnumeratePhysicalDevices failed' })),
        }));
        await expect(svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 2 }))
            .rejects.toMatchObject({ reason: 'gpu-not-ready' });
    });

    it('falls back to the illustration-safe model when JEV is unavailable', async () => {
        const svc = new UpscalerService();
        const bridge = makeBridge();
        svc.configure(bridge, vi.fn(async () => null));
        const { runMock } = bridge;
        await svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 4, prompt: 'a cover' });
        expect(runMock.mock.calls[0]?.[0].model).toBe('realesrgan-x4plus-anime');
    });

    it('uses the JEV-chosen model when the judgment resolves', async () => {
        const svc = new UpscalerService();
        const bridge = makeBridge();
        svc.configure(bridge, vi.fn(async (_prompt: string): Promise<UpscaleModel | null> => 'realesrgan-x4plus'));
        const { runMock } = bridge;
        await svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 4, prompt: 'cinematic photo of a studio' });
        expect(runMock.mock.calls[0]?.[0].model).toBe('realesrgan-x4plus');
    });

    it('an explicit model overrides the judgment', async () => {
        const svc = new UpscalerService();
        const judge = vi.fn(async (_prompt: string) => 'realesrgan-x4plus' as const);
        const bridge = makeBridge();
        svc.configure(bridge, judge);
        const { runMock } = bridge;
        await svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 2, model: 'realesrgan-x4plus-anime', prompt: 'x' });
        expect(judge).not.toHaveBeenCalled();
        expect(runMock.mock.calls[0]?.[0].model).toBe('realesrgan-x4plus-anime');
    });

    it('routes engine progress events for the matching requestId only', async () => {
        const svc = new UpscalerService();
        const listeners: ((p: { requestId: string; fraction: number }) => void)[] = [];
        let capturedReqId = '';
        const bridge = makeBridge({
            onProgress: vi.fn((cb: (p: { requestId: string; fraction: number }) => void) => {
                listeners.push(cb);
                return () => {};
            }),
            run: vi.fn(async (req: { requestId: string }) => {
                capturedReqId = req.requestId;
                listeners.forEach(l => l({ requestId: 'other-request', fraction: 0.1 }));
                listeners.forEach(l => l({ requestId: req.requestId, fraction: 0.5 }));
                return { outputDataUrl: 'data:image/png;base64,QQ==', durationMs: 1 };
            }),
        });
        svc.configure(bridge, vi.fn(async () => null));

        const seen: number[] = [];
        await svc.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 2, onProgress: (f) => seen.push(f) });
        expect(seen).toEqual([0.5]);
        expect(capturedReqId).toMatch(/^up-/);
    });
});
