/**
 * MediaJobExecutor — executes DIRECT MEDIA route decisions via MediaOps (MIG-004).
 *
 * This is the only place a routed fast-path job touches FFmpeg. Composed jobs
 * never reach this module — they dispatch through the VideoRendererContract.
 * Unknown operations fail closed.
 */

import { defaultBins, extractThumbnail, probeMedia, replaceAudioTrack, transcodeRescale, trimToSpan } from './MediaOps.js';
import type { MediaBinaries, ProbeSummary } from './MediaOps.js';
import type { VideoRouteDecision } from '@indii/shared';

export interface DirectMediaJobPayload {
    input: string;
    output: string;
    /** trim */
    startUs?: number;
    endUs?: number;
    /** transcode */
    width?: number;
    height?: number;
    fps?: number;
    /** audio_replace */
    audioInput?: string;
    normalize?: boolean;
    /** thumbnail */
    atUs?: number;
}

export class MediaJobError extends Error {
    constructor(message: string) {
        super(`media-job: ${message}`);
        this.name = 'MediaJobError';
    }
}

/**
 * Execute a routed direct-media job and return a probe of the artifact.
 * Rejects if the decision is not a direct-media decision, if the op is
 * unknown, or if required payload fields are missing.
 */
export const executeDirectMediaJob = async (
    decision: VideoRouteDecision,
    job: DirectMediaJobPayload,
    bins: MediaBinaries = defaultBins(),
): Promise<ProbeSummary> => {
    if (decision.route !== 'direct_media' || !decision.op) {
        throw new MediaJobError(`refusing non-direct route '${decision.route}' (${decision.reason})`);
    }

    switch (decision.op) {
        case 'trim': {
            const { startUs, endUs } = job;
            if (startUs === undefined || endUs === undefined) {
                throw new MediaJobError('trim requires startUs and endUs');
            }
            await trimToSpan({ input: job.input, output: job.output, startUs, endUs, bins });
            break;
        }
        case 'transcode':
            await transcodeRescale({
                input: job.input, output: job.output,
                width: job.width, height: job.height, fps: job.fps, bins,
            });
            break;
        case 'audio_replace': {
            if (!job.audioInput) throw new MediaJobError('audio_replace requires audioInput');
            await replaceAudioTrack({
                videoInput: job.input, audioInput: job.audioInput, output: job.output,
                normalize: job.normalize ?? false, bins,
            });
            break;
        }
        case 'thumbnail':
            await extractThumbnail(job.input, job.output, job.atUs ?? 0, bins);
            break;
        default: {
            const exhaustive: never = decision.op;
            throw new MediaJobError(`unknown direct op: ${String(exhaustive)}`);
        }
    }

    return probeMedia(job.output, bins);
};
