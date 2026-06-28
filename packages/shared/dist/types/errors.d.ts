export declare enum AppErrorCode {
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
    SAFETY_VIOLATION = "SAFETY_VIOLATION",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    INVALID_ARGUMENT = "INVALID_ARGUMENT",
    NETWORK_ERROR = "NETWORK_ERROR",
    AUTH_ERROR = "AUTH_ERROR",
    UNAUTHORIZED = "UNAUTHORIZED",
    NOT_FOUND = "NOT_FOUND",
    RATE_LIMITED = "RATE_LIMITED",
    TIMEOUT = "TIMEOUT",
    CANCELLED = "CANCELLED",
    CONTENT_FILTERED = "CONTENT_FILTERED",
    INVALID_INPUT = "INVALID_INPUT"
}
export interface ErrorDetails {
    field?: string;
    reason?: string;
    retryable?: boolean;
    retryAfterMs?: number;
    originalError?: Error | string;
    context?: Record<string, unknown>;
}
export interface AppError {
    code: AppErrorCode;
    message: string;
    details?: ErrorDetails;
}
export declare class AppException extends Error {
    code: AppErrorCode;
    details?: ErrorDetails;
    constructor(code: AppErrorCode, message: string, details?: ErrorDetails);
    toAppError(): AppError;
    static fromError(error: unknown, defaultCode?: AppErrorCode): AppException;
}
/**
 * QuotaExceededError - Thrown when a user exceeds their membership tier limits.
 * Contains actionable upgrade information for UI display.
 */
export type QuotaLimitType = 'images' | 'video' | 'video_duration' | 'storage' | 'projects' | 'resolution' | 'export';
export type MembershipTier = 'free' | 'pro' | 'enterprise' | 'pro_monthly' | 'pro_yearly' | 'studio' | 'founder';
export declare class QuotaExceededError extends AppException {
    limitType: QuotaLimitType;
    upgradeMessage: string;
    currentTier: MembershipTier;
    currentUsage: number;
    maxAllowed: number;
    constructor(limitType: QuotaLimitType, currentTier: MembershipTier, upgradeMessage: string, currentUsage: number, maxAllowed: number);
}
//# sourceMappingURL=errors.d.ts.map