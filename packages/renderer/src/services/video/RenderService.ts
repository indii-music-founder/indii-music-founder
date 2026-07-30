import { httpsCallable } from 'firebase/functions';

import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface RenderConfig {
    compositionId: string;
    outputLocation: string;
    inputProps: Record<string, unknown>;
    projectId?: string;
    organizationId?: string;
    codec?: 'h264' | 'vp8';
    useCloudQueue?: boolean;
}

export type VideoRenderReceipt =
    | {
        status: 'queued';
        renderId: string;
        projectId: string;
        progress: number;
    }
    | {
        status: 'running';
        renderId: string;
        projectId: string;
        progress: number;
        phase?: string;
    }
    | {
        status: 'completed';
        renderId: string;
        projectId: string;
        progress: 100;
        asset: {
            url: string;
            expiresAt: number;
            generation: string;
            mimeType: 'video/mp4';
        };
    }
    | {
        status: 'failed';
        renderId: string;
        projectId: string;
        progress: number;
        error: string;
    };

export type RenderResult = string | VideoRenderReceipt;

type CallableInvoker = (name: string, payload: Record<string, unknown>) => Promise<unknown>;
type Sleep = (milliseconds: number) => Promise<void>;

const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_RECEIPT_TIMEOUT_MS = 15 * 60 * 1_000;

function requiredIdentifier(value: unknown, field: string): string {
    if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
        throw new Error(`${field} is required for an authenticated private project render.`);
    }
    return value;
}

function parseReceipt(raw: unknown, expectedRenderId: string): VideoRenderReceipt {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('The server returned an invalid render receipt.');
    }
    const receipt = raw as Record<string, unknown>;
    const status = receipt.status;
    const renderId = requiredIdentifier(receipt.renderId, 'receipt.renderId');
    const projectId = requiredIdentifier(receipt.projectId, 'receipt.projectId');
    const progress = receipt.progress;
    if (
        renderId !== expectedRenderId
        || typeof progress !== 'number'
        || !Number.isFinite(progress)
        || progress < 0
        || progress > 100
    ) {
        throw new Error('The server returned an invalid render receipt.');
    }
    if (status === 'queued') {
        return { status, renderId, projectId, progress };
    }
    if (status === 'running') {
        const phase = typeof receipt.phase === 'string' && receipt.phase.trim()
            ? receipt.phase.trim()
            : undefined;
        return { status, renderId, projectId, progress, ...(phase ? { phase } : {}) };
    }
    if (status === 'failed') {
        if (typeof receipt.error !== 'string' || !receipt.error.trim()) {
            throw new Error('The server returned an invalid failed render receipt.');
        }
        return { status, renderId, projectId, progress, error: receipt.error.trim() };
    }
    if (status === 'completed') {
        const asset = receipt.asset;
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
            throw new Error('The server returned an invalid completed render receipt.');
        }
        const record = asset as Record<string, unknown>;
        if (
            progress !== 100
            || typeof record.url !== 'string'
            || !record.url.startsWith('https://')
            || typeof record.expiresAt !== 'number'
            || !Number.isFinite(record.expiresAt)
            || record.expiresAt <= Date.now()
            || typeof record.generation !== 'string'
            || !/^[1-9][0-9]{0,29}$/.test(record.generation)
            || record.mimeType !== 'video/mp4'
        ) {
            throw new Error('The server returned an invalid completed render receipt.');
        }
        return {
            status,
            renderId,
            projectId,
            progress: 100,
            asset: {
                url: record.url,
                expiresAt: record.expiresAt,
                generation: record.generation,
                mimeType: 'video/mp4',
            },
        };
    }
    throw new Error('The server returned an unknown render lifecycle status.');
}

const invokeCallable: CallableInvoker = async (name, payload) => {
    const callable = httpsCallable<Record<string, unknown>, unknown>(functions, name);
    const response = await callable(payload);
    return response.data;
};

const sleep: Sleep = milliseconds => new Promise(resolve => {
    setTimeout(resolve, milliseconds);
});

export class RenderService {
    constructor(
        private readonly call: CallableInvoker = invokeCallable,
        private readonly wait: Sleep = sleep,
        private readonly now: () => number = () => Date.now(),
    ) {}

    async queueComposition(config: RenderConfig): Promise<Extract<VideoRenderReceipt, { status: 'queued' }>> {
        const projectId = requiredIdentifier(config.projectId, 'projectId');
        const organizationId = requiredIdentifier(config.organizationId, 'organizationId');
        if (!config.inputProps.project || typeof config.inputProps.project !== 'object') {
            throw new Error('A canonical compiled video project is required.');
        }
        const raw = await this.call('renderVideo', {
            compositionId: config.compositionId,
            accessPolicy: 'private-project-render.v1',
            projectId,
            organizationId,
            inputProps: config.inputProps,
        });
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new Error('The server did not return a render queue receipt.');
        }
        const response = raw as Record<string, unknown>;
        const renderId = requiredIdentifier(response.renderId, 'renderId');
        if (response.success !== true) {
            throw new Error('The server did not accept the private render.');
        }
        return { status: 'queued', renderId, projectId, progress: 0 };
    }

    async getRenderReceipt(renderId: string): Promise<VideoRenderReceipt> {
        const expectedRenderId = requiredIdentifier(renderId, 'renderId');
        const raw = await this.call('getVideoRenderReceipt', { jobId: expectedRenderId });
        return parseReceipt(raw, expectedRenderId);
    }

    async waitForRender(
        renderId: string,
        onReceipt?: (receipt: VideoRenderReceipt) => void,
        options: { pollIntervalMs?: number; timeoutMs?: number } = {},
    ): Promise<Extract<VideoRenderReceipt, { status: 'completed' }>> {
        const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
        const timeoutMs = options.timeoutMs ?? DEFAULT_RECEIPT_TIMEOUT_MS;
        const deadline = this.now() + timeoutMs;
        while (this.now() <= deadline) {
            const receipt = await this.getRenderReceipt(renderId);
            onReceipt?.(receipt);
            if (receipt.status === 'completed') return receipt;
            if (receipt.status === 'failed') throw new Error(receipt.error);
            await this.wait(pollIntervalMs);
        }
        throw new Error('The private render is still running. Keep the job ID and retry status later.');
    }

    async renderCompositionCloud(
        config: RenderConfig,
        onProgress?: (progress: number) => void,
    ): Promise<Extract<VideoRenderReceipt, { status: 'completed' }>> {
        try {
            const queued = await this.queueComposition(config);
            onProgress?.(queued.progress);
            return await this.waitForRender(queued.renderId, receipt => onProgress?.(receipt.progress));
        } catch (error: unknown) {
            logger.error('[RenderService] Private server render failed:', error);
            throw new Error(
                `Failed to complete private server render: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async renderComposition(config: RenderConfig): Promise<RenderResult> {
        if (config.useCloudQueue) {
            return this.queueComposition(config);
        }

        try {
            logger.info(`[RenderService] Starting local render for ${config.compositionId}...`);
            const bundleLocation = import.meta.env.VITE_REMOTION_BUNDLE_PATH || './dist/remotion-bundle';
            const remotionPkg = '@remotion/renderer';
            const { renderMedia } = await import(/* @vite-ignore */ remotionPkg);
            await renderMedia({
                composition: {
                    id: config.compositionId,
                    props: config.inputProps as Record<string, unknown>,
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    durationInFrames: 300,
                },
                serveUrl: bundleLocation,
                codec: config.codec || 'h264',
                outputLocation: config.outputLocation,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            logger.info(`[RenderService] Render complete: ${config.outputLocation}`);
            return config.outputLocation;
        } catch (error: unknown) {
            logger.error('[RenderService] Render failed:', error);
            throw new Error(`Failed to render composition: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export const renderService = new RenderService();
