import { AppErrorCode, AppException } from '@/shared/types/errors';

/** Shown in place of an error when the user pressed Stop (ISSUE-1667). */
export const USER_STOPPED_TEXT = '*(Stopped by user.)*';

/**
 * True when a failed agent run was ended by the user's Stop rather than a fault.
 * `stopAgent()` aborts with a plain string reason, so `throwIfAborted()` throws
 * that string, which previously rendered as "❌ Error: The request failed."
 */
export function isUserCancellation(err: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    if (err instanceof AppException) return err.code === AppErrorCode.CANCELLED;
    if (typeof DOMException !== 'undefined' && err instanceof DOMException) return err.name === 'AbortError';
    return false;
}

/** Readable message for any thrown value, including non-Error throws. */
export function errorText(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return '';
}
