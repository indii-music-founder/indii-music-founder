export enum AppErrorCode {
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    SAFETY_VIOLATION = 'SAFETY_VIOLATION',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    INVALID_ARGUMENT = 'INVALID_ARGUMENT'
}

export interface AppError {
    code: AppErrorCode;
    message: string;
    details?: any;
}
