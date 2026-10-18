import type { AgentResponse, ToolFunctionResult } from '@/services/agent/types';

/** A cached reference to a gallery item must still resolve its saved original. */
export function printGalleryReference(sourceId: string | undefined,
    references: ReadonlyArray<{ id: string; alias: string; url: string }> | undefined) {
    return references?.find(reference => reference.id === sourceId && reference.alias.startsWith('gallery-'));
}

export class PrintCropCancelledError extends Error {
    constructor() {
        super('Print crop was not approved. No print file was produced.');
        this.name = 'PrintCropCancelledError';
    }
}

/** A declined crop ends this invocation; transient preparation failures may retry. */
export function cancelledPrintResponse(name: string, result: ToolFunctionResult | string,
    toolCalls: NonNullable<AgentResponse['toolCalls']>): AgentResponse | null {
    if (name !== 'prepare_print_file' || typeof result === 'string' || result.success ||
        result.status !== 'CANCELLED' || result.metadata?.errorCode !== 'PRINT_CROP_CANCELLED') return null;
    return { text: result.message || result.error || 'Print preparation cancelled.', toolCalls, error: 'PRINT_CROP_CANCELLED' };
}

/** Once pixels exist, report persistence truth instead of regenerating on bookkeeping failure. */
export function finishedPrintResponse(name: string, result: ToolFunctionResult | string,
    toolCalls: NonNullable<AgentResponse['toolCalls']>): AgentResponse | null {
    if (name !== 'prepare_print_file' || typeof result === 'string' || !result.success ||
        result.data?.fileCreated !== true || typeof result.data?.gallerySaved !== 'boolean' || typeof result.data?.versionRecorded !== 'boolean' ||
        typeof result.data?.assetId !== 'string' || !result.data.assetId ||
        (result.data.gallerySaved && (typeof result.data.url !== 'string' || !result.data.url)) ||
        (result.data.versionRecorded && !result.data.gallerySaved) ||
        /awaiting|pending|queued|running|processing|executing|enqueued/i.test(String(result.status ?? result.data.status ?? ''))) return null;
    return { text: result.message || (result.data.gallerySaved ? 'Print master saved to your gallery; check its version status.' : 'Print file created, but gallery storage failed. Keep this session open.'), data: result.data, toolCalls };
}
