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
    onRetry: () => { },
};

/**
 * Execute a function with exponential backoff retry logic
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if error is retryable
            const isRetryable = opts.retryableErrors.some((errCode) =>
                lastError.message.includes(errCode)
            );

            if (!isRetryable || attempt === opts.maxAttempts) {
                throw lastError;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
                opts.maxDelayMs
            );

            opts.onRetry(attempt, lastError);

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Create an abortable promise with timeout
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
): AbortablePromise<T> {
    let timeoutId: NodeJS.Timeout;
    let aborted = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            if (!aborted) {
                reject(new Error(timeoutMessage));
            }
        }, timeoutMs);
    });

    const wrappedPromise = Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    }) as AbortablePromise<T>;

    wrappedPromise.abort = () => {
        aborted = true;
        clearTimeout(timeoutId);
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
            if (Date.now() - this.lastFailureTime! >= this.timeout) {
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

        if (this.failureCount >= this.threshold) {
            this.state = 'open';
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
        this.abortCallbacks.forEach((cb) => cb());
    }

    isAborted(): boolean {
        return this.aborted;
    }

    onAbort(callback: () => void): void {
        if (this.aborted) {
            callback();
        } else {
            this.abortCallbacks.push(callback);
        }
    }

    throwIfAborted(): void {
        if (this.aborted) {
            throw new Error('Operation was cancelled');
        }
    }
}
