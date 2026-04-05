/**
 * RateLimiter
 * Implements a Token Bucket algorithm to control the rate of operations.
 */
export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRatePerSecond: number;
    private readonly refillInterval: number; // ms

    constructor(
        maxRequestsPerMinute: number,
        initialBurst: number = maxRequestsPerMinute
    ) {
        this.maxTokens = initialBurst;
        this.tokens = initialBurst;
        this.lastRefill = Date.now();
        // Calculate refill rate
        this.refillRatePerSecond = maxRequestsPerMinute / 60;
        this.refillInterval = 1000; // Refill every second for smoothness
    }

    /**
     * Attempts to acquire a token. 
     * If tokens are available, consumes one and returns true.
     * If not, returns false.
     */
    public tryAcquire(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    /**
     * Acquires a token, waiting if necessary.
     * @param timeoutMs Maximum time to wait for a token.
     */
    public async acquire(timeoutMs: number = 30000): Promise<void> {
        if (this.tryAcquire()) return;

        const startTime = Date.now();

        while (true) {
            // Calculate time until next token might be available
            // tokens = refillRate * time
            // 1 = refillRate * timeNeeded
            // timeNeeded = 1 / refillRate (seconds)
            const timeToWaitMs = (1 / this.refillRatePerSecond) * 1000;

            // Wait a small bit or the calculated time
            const waitTime = Math.min(timeToWaitMs, 1000);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Rate limit acquisition timed out');
            }

            if (this.tryAcquire()) return;
        }
    }

    private refill() {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRefill) / 1000;

        if (elapsedSeconds > 0) {
            const newTokens = elapsedSeconds * this.refillRatePerSecond;
            this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
            this.lastRefill = now;
        }
    }

    public getRemainingTokens(): number {
        this.refill();
        return Math.floor(this.tokens);
    }
}
