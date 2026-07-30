/** FIFO token bucket for client-side admission pacing. */
export class RateLimiter {
    private tokens: number;
    private lastRefill = Date.now();
    private readonly maxTokens: number;
    private readonly refillRatePerSecond: number;
    private queue: Array<() => void> = [];
    private draining = false;

    constructor(maxRequestsPerMinute: number, initialBurst: number = maxRequestsPerMinute) {
        this.maxTokens = initialBurst;
        this.tokens = initialBurst;
        this.refillRatePerSecond = maxRequestsPerMinute / 60;
    }

    public tryAcquire(): boolean {
        this.refill();
        if (this.tokens < 1) return false;
        this.tokens -= 1;
        return true;
    }

    public async acquire(timeoutMs = 30_000, signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) throw new Error(String(signal.reason || 'Rate limit acquisition cancelled'));
        if (this.queue.length === 0 && this.tryAcquire()) return;
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                const index = this.queue.indexOf(run);
                if (index >= 0) this.queue.splice(index, 1);
            };
            const settle = (callback: () => void) => {
                if (settled) return;
                settled = true;
                cleanup();
                callback();
            };
            const run = () => settle(resolve);
            const onAbort = () => settle(() => reject(new Error(String(signal?.reason || 'Rate limit acquisition cancelled'))));
            const timeout = setTimeout(() => settle(() => reject(new Error('Rate limit acquisition timed out'))), timeoutMs);
            signal?.addEventListener('abort', onAbort, { once: true });
            this.queue.push(run);
            this.drain();
        });
    }

    private drain(): void {
        if (this.draining) return;
        this.draining = true;
        const run = () => {
            this.refill();
            while (this.queue.length > 0 && this.tokens >= 1) {
                this.tokens -= 1;
                this.queue.shift()!();
            }
            if (this.queue.length === 0) { this.draining = false; return; }
            const waitMs = Math.max(1, Math.ceil((1 - this.tokens) / this.refillRatePerSecond * 1000));
            setTimeout(run, waitMs);
        };
        run();
    }

    private refill(): void {
        const now = Date.now();
        this.tokens = Math.min(this.maxTokens, this.tokens + ((now - this.lastRefill) / 1000) * this.refillRatePerSecond);
        this.lastRefill = now;
    }

    public getRemainingTokens(): number { this.refill(); return Math.floor(this.tokens); }
}
