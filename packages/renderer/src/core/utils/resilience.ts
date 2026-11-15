/**
 * Retry Utility with Exponential Backoff
 * Implements resilient API call patterns for production stability
 */

export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
    onRetry?: (attempt: number, error: Error) => void;
}

export interface AbortablePromise<T> extends Promise<T> {
    abort: () => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'Network Error'],
    onRetry: (attempt: number, error: Error) => {
        // Default logger output to prevent empty stub warning and keep trace in debug log.
        console.debug(`[Resilience] Retrying after attempt ${attempt} due to error:`, error);
    },
};

/**
 * Execute a function with exponential backoff retry logic
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    if (!Number.isFinite(opts.maxAttempts) || opts.maxAttempts < 1) {
        throw new Error(`maxAttempts must be at least 1 (received ${opts.maxAttempts})`);
    }
    const maxAttempts = Math.floor(opts.maxAttempts);
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorCode = (error as { code?: unknown } | null)?.code;

            // Check if error is retryable by message substring or error.code
            const isRetryable = opts.retryableErrors.some((errCode) =>
                lastError!.message.includes(errCode) || errorCode === errCode
            );

            if (!isRetryable || attempt === maxAttempts) {
                throw lastError;
            }

            // Calculate delay with exponential backoff
            const delay = Math.max(
                0,
                Math.min(
                    opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
                    opts.maxDelayMs
                )
            );

            opts.onRetry(attempt, lastError);

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError ?? new Error('Retry failed without error');
}

/**
 * Create an abortable promise with timeout
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
): AbortablePromise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let rejectTimeout: ((reason?: unknown) => void) | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        rejectTimeout = reject;
        const safeTimeoutMs = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : 0;
        timeoutId = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error(timeoutMessage));
            }
        }, safeTimeoutMs);
    });

    const wrappedPromise = Promise.race([promise, timeoutPromise]).finally(() => {
        settled = true;
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }) as AbortablePromise<T>;

    wrappedPromise.abort = () => {
        if (settled) return;
        settled = true;
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
        rejectTimeout?.(new Error('Operation aborted'));
    };

    return wrappedPromise;
}

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by stopping requests to failing services
 */
export class CircuitBreaker {
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime: number | null = null;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
        private readonly threshold: number = 5,
        private readonly timeout: number = 60000, // 1 minute
        private readonly successThreshold: number = 2
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (this.lastFailureTime !== null && Date.now() - this.lastFailureTime >= this.timeout) {
                this.state = 'half-open';
                this.successCount = 0;
            } else {
                throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error: unknown) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === 'half-open') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.state = 'closed';
                this.successCount = 0;
            }
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'half-open' || this.failureCount >= this.threshold) {
            this.state = 'open';
            this.successCount = 0;
        }
    }

    getState(): 'closed' | 'open' | 'half-open' {
        return this.state;
    }

    reset(): void {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.state = 'closed';
    }
}

/**
 * Request Cancellation Token
 * Allows aborting in-flight requests when component unmounts
 */
export class CancellationToken {
    private aborted = false;
    private abortCallbacks: Array<() => void> = [];

    abort(): void {
        if (this.aborted) return;
        this.aborted = true;
        const callbacks = [...this.abortCallbacks];
        this.abortCallbacks = [];
        for (const cb of callbacks) {
            try {
                cb();
            } catch {
                // Isolate abort listeners so one failing callback does not block cleanup of others
            }
        }
    }

    isAborted(): boolean {
        return this.aborted;
    }

    onAbort(callback: () => void): () => void {
        if (this.aborted) {
            callback();
            return () => {};
        }
        this.abortCallbacks.push(callback);
        return () => {
            const index = this.abortCallbacks.indexOf(callback);
            if (index !== -1) {
                this.abortCallbacks.splice(index, 1);
            }
        };
    }

    throwIfAborted(): void {
        if (this.aborted) {
            throw new Error('Operation was cancelled');
        }
    }
}
