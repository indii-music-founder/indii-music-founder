"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaExceededError = exports.AppException = exports.AppErrorCode = void 0;
var AppErrorCode;
(function (AppErrorCode) {
    AppErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    AppErrorCode["SAFETY_VIOLATION"] = "SAFETY_VIOLATION";
    AppErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    AppErrorCode["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
    AppErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    AppErrorCode["AUTH_ERROR"] = "AUTH_ERROR";
    AppErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    AppErrorCode["NOT_FOUND"] = "NOT_FOUND";
    AppErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    AppErrorCode["TIMEOUT"] = "TIMEOUT";
    AppErrorCode["CANCELLED"] = "CANCELLED";
    AppErrorCode["CONTENT_FILTERED"] = "CONTENT_FILTERED";
    AppErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
})(AppErrorCode || (exports.AppErrorCode = AppErrorCode = {}));
class AppException extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'AppException';
        this.code = code;
        this.details = details;
    }
    toAppError() {
        return {
            code: this.code,
            message: this.message,
            details: this.details
        };
    }
    static fromError(error, defaultCode = AppErrorCode.INTERNAL_ERROR) {
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
exports.AppException = AppException;
class QuotaExceededError extends AppException {
    constructor(limitType, currentTier, upgradeMessage, currentUsage, maxAllowed) {
        super(AppErrorCode.QUOTA_EXCEEDED, `Quota exceeded: ${limitType}. ${upgradeMessage}`, {
            context: {
                limitType,
                currentTier,
                currentUsage,
                maxAllowed
            }
        });
        this.name = 'QuotaExceededError';
        this.limitType = limitType;
        this.upgradeMessage = upgradeMessage;
        this.currentTier = currentTier;
        this.currentUsage = currentUsage;
        this.maxAllowed = maxAllowed;
    }
}
exports.QuotaExceededError = QuotaExceededError;
//# sourceMappingURL=errors.js.map