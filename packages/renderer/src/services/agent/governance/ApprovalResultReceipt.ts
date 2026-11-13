import type { ToolFunctionResult } from '../types';

/** A tool outcome and the acknowledgement of its approval record are separate facts. */
export function unconfirmedApprovalResult(result: ToolFunctionResult, approvalId: string): ToolFunctionResult {
    return {
        ...result,
        metadata: {
            ...result.metadata,
            approvalPersistence: { status: 'unconfirmed', approvalId },
        },
    };
}

export function approvalRecordingWarning(result: ToolFunctionResult): string | undefined {
    const receipt = result.metadata?.approvalPersistence;
    if (!receipt || typeof receipt !== 'object' || !('status' in receipt) || receipt.status !== 'unconfirmed') return undefined;
    return `The tool reported ${result.success ? 'success' : 'failure'}, but its approval record could not be confirmed. Check the action before retrying; do not retry automatically.`;
}
