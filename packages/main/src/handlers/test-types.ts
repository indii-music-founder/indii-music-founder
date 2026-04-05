/**
 * Shared type for IPC handler test results.
 * Used by security test files to avoid `any` in handler return types.
 */
export interface HandlerResult {
    success: boolean;
    error?: string;
    status?: string;
    data?: unknown;
    hash?: string;
    metadata?: unknown;
    streams?: unknown[];
    path?: string;
}
