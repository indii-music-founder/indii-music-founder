import { logger } from '@/utils/logger';
import { AppException, AppErrorCode } from '@/shared/types/errors';

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
    fallbackResponse?: unknown;
}

/**
 * Non-recoverable AppErrorCodes that should NEVER trip the circuit breaker.
 * These represent configuration, auth, or input errors — retrying won't help.
 */
const NON_RECOVERABLE_APP_CODES = new Set<AppErrorCode>([
    AppErrorCode.UNAUTHORIZED,
    AppErrorCode.AUTH_ERROR,
    AppErrorCode.INVALID_ARGUMENT,
    AppErrorCode.INVALID_INPUT,
    AppErrorCode.CANCELLED,
    AppErrorCode.SAFETY_VIOLATION,
    AppErrorCode.CONTENT_FILTERED,
]);

/**
 * Checks if an error is a non-recoverable configuration/permission error.
 * These errors should fail fast and NOT trip the circuit breaker.
 *
 * Covers:
 *   - AppException wrappers with retryable: false or non-recoverable error codes
 *   - Firebase App Check / Installations errors
 *   - Firebase auth / API key errors
 *   - HTTP 404 (model not found) from @google/genai SDK
 *   - HTTP 400 (bad request / invalid model) from @google/genai SDK
 *
 * CRITICAL: handleError() in FirebaseAIService transforms raw SDK errors into
 * AppException objects BEFORE they reach the circuit breaker. Without this
 * AppException-aware check, wrapped permission/auth/config errors would be
 * misclassified as recoverable and trip the breaker permanently.
 */
function isNonRecoverableError(error: unknown): boolean {
    // ── AppException-aware detection (MUST come first) ──
    // handleError() wraps raw SDK errors into AppException with retryable: false
    // for config/permission issues. If we don't catch these here, the breaker
    // sees "AI Verification Failed" instead of "permission-denied" and trips.
    if (error instanceof AppException) {
        // Explicit retryable: false flag from handleError() → non-recoverable
        if (error.details?.retryable === false) {
            return true;
        }
        // Known non-recoverable error codes
        if (NON_RECOVERABLE_APP_CODES.has(error.code)) {
            return true;
        }
    }

    // ── Raw SDK error detection (for errors that bypass handleError()) ──
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code || '';
    const httpStatus = (error as { status?: number })?.status;

    // @google/genai ApiError with HTTP status codes
    // 404 = model not found, 400 = bad request / invalid model config
    if (httpStatus === 404 || httpStatus === 400) {
        return true;
    }

    // Firebase App Check / Installations errors - configuration issue, won't recover with retry
    if (msg.includes('installations/request-failed') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('permission-denied') ||
        msg.includes('app-check-token') ||
        msg.includes('The caller does not have permission')) {
        return true;
    }

    // Firebase configuration errors
    if (code === 'auth/invalid-api-key' ||
        code === 'auth/api-key-not-valid' ||
        msg.includes('Invalid API key') ||
        msg.includes('API key not valid')) {
        return true;
    }

    // Model-not-found indicators in error messages (in case status is not set)
    if (msg.includes('models/') && msg.includes('is not found') ||
        msg.includes('404') && msg.includes('models/')) {
        return true;
    }

    return false;
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private readonly config: CircuitBreakerConfig;

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
    }

    public async execute<T>(action: () => Promise<T>, fallback?: T): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
                logger.info(`[CircuitBreaker] Timeout elapsed, transitioning OPEN → HALF_OPEN for probe attempt`);
                this.state = CircuitState.HALF_OPEN;
            } else {
                const remainingMs = this.config.resetTimeoutMs - (Date.now() - this.lastFailureTime);
                logger.warn(`[CircuitBreaker] Circuit OPEN — rejecting request. Retry in ${Math.round(remainingMs / 1000)}s`);
                if (fallback !== undefined) return fallback;
                if (this.config.fallbackResponse !== undefined) return this.config.fallbackResponse as T;
                throw new Error('CircuitBreaker: Service is currently unavailable (Circuit OPEN).');
            }
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error: unknown) {
            // Non-recoverable errors should fail fast WITHOUT tripping the circuit.
            // CRITICAL: handleError() wraps raw SDK errors into AppException objects.
            // Without this check, wrapped permission/auth errors would trip the breaker.
            if (isNonRecoverableError(error)) {
                const errName = error instanceof AppException
                    ? `AppException(${error.code}, retryable=${error.details?.retryable})`
                    : (error instanceof Error ? error.constructor.name : 'unknown');
                logger.warn(`[CircuitBreaker] Non-recoverable error bypassing breaker (${errName}):`,
                    error instanceof Error ? error.message : String(error));
                throw error;
            }

            this.onFailure(error);
            if (fallback !== undefined) return fallback;
            if (this.config.fallbackResponse !== undefined) return this.config.fallbackResponse as T;
            throw error;
        }
    }

    private onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            logger.info(`[CircuitBreaker] ✅ Probe succeeded — HALF_OPEN → CLOSED. Service recovered.`);
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
        } else {
            this.failureCount = 0;
        }
    }

    private onFailure(error: unknown) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        const errMsg = error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120);

        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
            logger.error(`[CircuitBreaker] ❌ Probe failed — HALF_OPEN → OPEN. Error: ${errMsg}`);
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            logger.error(`[CircuitBreaker] 🔴 Failure threshold reached (${this.failureCount}/${this.config.failureThreshold}) — CLOSED → OPEN. Last error: ${errMsg}`);
        } else {
            logger.warn(`[CircuitBreaker] Failure ${this.failureCount}/${this.config.failureThreshold} in CLOSED state. Error: ${errMsg}`);
        }
    }

    public getState(): CircuitState {
        return this.state;
    }

    /**
     * Manually reset the circuit breaker (useful for testing or manual recovery)
     */
    public reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}
