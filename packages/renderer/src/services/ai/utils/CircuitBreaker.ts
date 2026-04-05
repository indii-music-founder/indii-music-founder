import { logger } from '@/utils/logger';

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
 * Checks if an error is a non-recoverable configuration/permission error.
 * These errors should fail fast and NOT trip the circuit breaker.
 */
function isNonRecoverableError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code || '';

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
                this.state = CircuitState.HALF_OPEN;
                // Testing service...
            } else {
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
            // Non-recoverable errors should fail fast WITHOUT tripping the circuit
            // These are configuration issues that won't be fixed by retrying
            if (isNonRecoverableError(error)) {
                logger.error('[CircuitBreaker] Non-recoverable error detected, failing fast:', error);
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
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            // Service recovered. State changed to CLOSED.
        } else {
            // Reset failure count on success in CLOSED state if we want strict consecutive counting
            // Alternatively, some breakers use a time window. We'll stick to consecutive for simplicity as per plan.
            this.failureCount = 0;
        }
    }

    private onFailure(_error: unknown) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
            // Recovery failed. State changed back to OPEN.
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            // Failure threshold reached. State changed to OPEN.
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
