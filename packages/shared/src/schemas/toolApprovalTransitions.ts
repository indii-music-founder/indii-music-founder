/**
 * The exact client writes allowed on `users/{uid}/tool_approvals/{id}` by
 * firestore.rules. Both the renderer (ToolApprovalService) and the rules
 * emulator suite build their patches here, so a client change that the rules
 * would deny fails the rules tests instead of failing users in production.
 *
 * `T` is the timestamp sentinel of the caller's SDK (`serverTimestamp()`).
 */
export interface ToolApprovalResult {
    success: boolean;
    error?: string;
}

/** pending -> approved: rules allow only `status` and `resolvedAt`. */
export function toolApprovalConsentPatch<T>(now: T) {
    return { status: 'approved' as const, resolvedAt: now };
}

/** approved -> claimed: rules allow only `status` and `claimedAt`. */
export function toolApprovalClaimPatch<T>(now: T) {
    return { status: 'claimed' as const, claimedAt: now };
}

/** pending -> denied: rules allow only `status`, `resolvedAt` and `denyReason`. */
export function toolApprovalDenyPatch<T>(now: T, reason?: string) {
    return { status: 'denied' as const, resolvedAt: now, ...(reason ? { denyReason: reason } : {}) };
}

/** claimed -> executed | failed: rules allow only `status` and `result` ({ success, error? }). */
export function toolApprovalCompletionPatch(result: ToolApprovalResult) {
    return {
        status: result.success ? 'executed' as const : 'failed' as const,
        result: {
            success: result.success,
            ...(typeof result.error === 'string' ? { error: result.error } : {}),
        },
    };
}
