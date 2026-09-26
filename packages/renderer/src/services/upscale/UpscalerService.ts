/**
 * UpscalerService — renderer facade for the local upscale engine (ISSUE-323).
 *
 * One entry point for desktop local super-resolution. The renderer never sees
 * file paths: bytes go over as a data URL and come back as one. JEV refines
 * model selection from the generation prompt; the deterministic fallback
 * (illustration-safe x4plus-anime) always applies when the judgment is
 * unavailable or undecided.
 */

import { judgeUpscaleModel } from '@/config/typesafeJudgments';
import { logger } from '@/utils/logger';

export type UpscaleModel = 'realesrgan-x4plus' | 'realesrgan-x4plus-anime';

export type UpscaleUnavailableReason = 'no-electron' | 'provision-failed' | 'gpu-not-ready';

export class UpscaleUnavailableError extends Error {
    constructor(public readonly reason: UpscaleUnavailableReason, message: string) {
        super(message);
        this.name = 'UpscaleUnavailableError';
    }
}

export interface UpscaleBridge {
    ensureEngine: () => Promise<{ enginePath: string; version: string; fromCache: boolean }>;
    probe: () => Promise<{ enginePresent: boolean; gpuReady: boolean; detail: string }>;
    run: (req: { requestId: string; dataUrl: string; scale: 2 | 4; model?: string; tilePx?: number }) =>
        Promise<{ outputDataUrl: string; durationMs: number }>;
    onProgress: (callback: (progress: { requestId: string; fraction: number }) => void) => () => void;
}

export interface UpscaleOptions {
    dataUrl: string;
    scale: 2 | 4;
    /** Generation prompt — refines model choice via JEV when available. */
    prompt?: string;
    tilePx?: number;
    onProgress?: (fraction: number) => void;
    model?: UpscaleModel;
}

export interface UpscaleOutcome {
    outputDataUrl: string;
    scale: 2 | 4;
    model: UpscaleModel;
    durationMs: number;
}

const DEFAULT_MODEL: UpscaleModel = 'realesrgan-x4plus-anime';

type ModelJudge = (prompt: string) => Promise<UpscaleModel | null>;

export class UpscalerService {
    private bridge: UpscaleBridge | null = null;
    private ensurePromise: Promise<void> | null = null;
    private modelJudge: ModelJudge = judgeUpscaleModel;

    /** Test seam: inject a bridge + judgment dependency. */
    configure(bridge: UpscaleBridge | null, modelJudge?: ModelJudge): void {
        this.bridge = bridge;
        if (modelJudge) this.modelJudge = modelJudge;
        this.ensurePromise = null;
    }

    private bridgeOrThrow(): UpscaleBridge {
        const bridge = this.bridge ?? (typeof window !== 'undefined' ? window.electronAPI?.upscale ?? null : null);
        if (!bridge) throw new UpscaleUnavailableError('no-electron', 'Local upscaling requires the indii desktop app.');
        return bridge;
    }

    private async ensureEngine(bridge: UpscaleBridge): Promise<void> {
        this.ensurePromise ??= (async () => {
            const install = await bridge.ensureEngine();
            logger.info(`[UpscalerService] engine ${install.version} ready (cached: ${install.fromCache})`);
        })().catch((err: unknown) => {
            this.ensurePromise = null; // allow clean retry
            logger.warn('[UpscalerService] engine provisioning failed:', err);
            throw new UpscaleUnavailableError('provision-failed', err instanceof Error ? err.message : String(err));
        });
        await this.ensurePromise;
    }

    async upscale(opts: UpscaleOptions): Promise<UpscaleOutcome> {
        const bridge = this.bridgeOrThrow();
        await this.ensureEngine(bridge);

        const probe = await bridge.probe();
        if (!probe.gpuReady) {
            throw new UpscaleUnavailableError(
                'gpu-not-ready',
                `Local engine cannot run on this machine: ${probe.detail.slice(0, 160)}`,
            );
        }

        const model = opts.model
            ?? await this.modelJudge(opts.prompt ?? '').catch(() => null)
            ?? DEFAULT_MODEL;

        const requestId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const unsubscribe = opts.onProgress
            ? bridge.onProgress((progress) => {
                if (progress.requestId === requestId) opts.onProgress!(progress.fraction);
            })
            : null;

        try {
            const result = await bridge.run({
                requestId,
                dataUrl: opts.dataUrl,
                scale: opts.scale,
                model,
                tilePx: opts.tilePx,
            });
            return { outputDataUrl: result.outputDataUrl, scale: opts.scale, model, durationMs: result.durationMs };
        } finally {
            unsubscribe?.();
        }
    }
}

export const upscalerService = new UpscalerService();
