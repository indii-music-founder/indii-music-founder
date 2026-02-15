export enum AppErrorCode {
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    SAFETY_VIOLATION = 'SAFETY_VIOLATION',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    INVALID_ARGUMENT = 'INVALID_ARGUMENT',
    NETWORK_ERROR = 'NETWORK_ERROR',
    AUTH_ERROR = 'AUTH_ERROR',
    UNAUTHORIZED = 'UNAUTHORIZED',
    NOT_FOUND = 'NOT_FOUND',
    RATE_LIMITED = 'RATE_LIMITED',
    TIMEOUT = 'TIMEOUT',
    CANCELLED = 'CANCELLED'
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

export class AppException extends Error {
    code: AppErrorCode;
    details?: ErrorDetails;

    constructor(code: AppErrorCode, message: string, details?: ErrorDetails) {
        super(message);
        this.name = 'AppException';
        this.code = code;
        this.details = details;
    }

    toAppError(): AppError {
        return {
            code: this.code,
            message: this.message,
            details: this.details
        };
    }

    static fromError(error: unknown, defaultCode: AppErrorCode = AppErrorCode.INTERNAL_ERROR): AppException {
        if (error instanceof AppException) {
            return error;
        }
        if (error instanceof Error) {
            return new AppException(defaultCode, error.message, {
                originalError: error.message
            });
        }
        return new AppException(defaultCode, String(error));
    }
}

/**
 * QuotaExceededError - Thrown when a user exceeds their membership tier limits.
 * Contains actionable upgrade information for UI display.
 */
export type QuotaLimitType = 'images' | 'video' | 'video_duration' | 'storage' | 'projects' | 'resolution' | 'export';
export type MembershipTier = 'free' | 'pro' | 'enterprise' | 'pro_monthly' | 'pro_yearly' | 'studio';

export class QuotaExceededError extends AppException {
    limitType: QuotaLimitType;
    upgradeMessage: string;
    currentTier: MembershipTier;
    currentUsage: number;
    maxAllowed: number;

    constructor(
        limitType: QuotaLimitType,
        currentTier: MembershipTier,
        upgradeMessage: string,
        currentUsage: number,
        maxAllowed: number
    ) {
        super(
            AppErrorCode.QUOTA_EXCEEDED,
            `Quota exceeded: ${limitType}. ${upgradeMessage}`,
            {
                context: {
                    limitType,
                    currentTier,
                    currentUsage,
                    maxAllowed
                }
            }
        );
        this.name = 'QuotaExceededError';
        this.limitType = limitType;
        this.upgradeMessage = upgradeMessage;
        this.currentTier = currentTier;
        this.currentUsage = currentUsage;
        this.maxAllowed = maxAllowed;
    }
}
