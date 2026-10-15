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
