/**
 * VideoRenderer contract — the frozen boundary between indii and its render engines.
 * (MIG-002, ADR-001)
 *
 * The receipt protocol below is the load-bearing surface and is preserved VERBATIM
 * from the legacy service. Engines implement this contract; engine types may not
 * appear in this file or anywhere above the boundary. Swapping engines must never
 * change what callers observe here.
 */

export type VideoRenderLifecycleStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface QueuedRenderReceipt {
    status: 'queued';
    renderId: string;
    projectId: string;
    progress: number;
}

export interface RunningRenderReceipt {
    status: 'running';
    renderId: string;
    projectId: string;
    progress: number;
    phase?: string;
}

export interface CompletedRenderAsset {
    /** Signed https URL for cloud output or file URL for a trusted local adapter. */
    url: string;
    /** Epoch ms expiry of the signed URL. */
    expiresAt: number;
    /** Storage generation of the output object (stale-read protection). */
    generation: string;
    mimeType: 'video/mp4';
}

export interface CompletedRenderReceipt {
    status: 'completed';
    renderId: string;
    projectId: string;
    progress: 100;
    asset: CompletedRenderAsset;
}

export interface FailedRenderReceipt {
    status: 'failed';
    renderId: string;
    projectId: string;
    progress: number;
    error: string;
}

export type VideoRenderReceipt =
    | QueuedRenderReceipt
    | RunningRenderReceipt
    | CompletedRenderReceipt
    | FailedRenderReceipt;

/** Local renders may resolve to an output path string; cloud renders resolve to receipts. */
export type RenderResult = string | VideoRenderReceipt;

/**
 * Request surface for render work.
 *
 * `compositionId` is a compatibility/profile identifier, not routing authority.
 * Canonical route selection comes from RenderPlanner. `inputProps.project` carries
 * the `IndiiVideoProject` or a lower-boundary adapter input after compilation.
 */
export interface VideoRenderConfig {
    compositionId: string;
    outputLocation: string;
    inputProps: Record<string, unknown>;
    projectId?: string;
    organizationId?: string;
    codec?: 'h264' | 'vp8';
    useCloudQueue?: boolean;
}

export interface WaitForRenderOptions {
    pollIntervalMs?: number;
    timeoutMs?: number;
}

/**
 * The engine seam. Any composition/render engine — the current adapter or a
 * future indii-owned engine — implements exactly this surface, plus the
 * shared contract-compliance suite (MIG-006).
 */
export interface VideoRendererContract {
    /** Admit a render job; resolves with the initial queued receipt. */
    queueComposition(config: VideoRenderConfig): Promise<QueuedRenderReceipt>;
    /** Read the current lifecycle receipt for a render job. */
    getRenderReceipt(renderId: string): Promise<VideoRenderReceipt>;
    /** Poll until completed/failed; invokes onReceipt for every observed transition. */
    waitForRender(
        renderId: string,
        onReceipt?: (receipt: VideoRenderReceipt) => void,
        options?: WaitForRenderOptions,
    ): Promise<CompletedRenderReceipt>;
    /** Queue + wait convenience with progress callback; fails closed via thrown errors. */
    renderCompositionCloud(
        config: VideoRenderConfig,
        onProgress?: (progress: number) => void,
    ): Promise<CompletedRenderReceipt>;
    /** Local execution path; returns an output path string or a receipt. */
    renderComposition(config: VideoRenderConfig): Promise<RenderResult>;
}
