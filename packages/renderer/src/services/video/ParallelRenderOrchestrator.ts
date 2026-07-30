import { logger } from '@/utils/logger';

export interface ParallelRenderOptions {
    projectId: string;
    compositionId: string;
    segmentDurationSeconds: number;
    audioTrackUrl?: string;
}

export interface ParallelRenderUnsupported {
    status: 'unsupported';
    code: 'PRIVATE_PARALLEL_RENDER_NOT_IMPLEMENTED';
    message: string;
}

/**
 * Chunk rendering cannot safely reuse the single-output private render
 * authority: each chunk needs its own durable identity, generation receipt,
 * and server-owned stitch manifest. Fail closed until that contract exists.
 */
export class ParallelRenderOrchestrator {
    static async renderLongFormParallel(
        _options: ParallelRenderOptions,
        _onProgress?: (pct: number) => void,
    ): Promise<ParallelRenderUnsupported> {
        const result: ParallelRenderUnsupported = {
            status: 'unsupported',
            code: 'PRIVATE_PARALLEL_RENDER_NOT_IMPLEMENTED',
            message: 'Parallel private rendering is unavailable until server-owned chunk and stitch receipts are implemented.',
        };
        logger.warn(`[ParallelRenderOrchestrator] ${result.message}`);
        return result;
    }
}
