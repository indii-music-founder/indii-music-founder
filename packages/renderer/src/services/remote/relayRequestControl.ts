/** Share an outstanding request, without caching failures or settled results. */
export class SingleFlight<T> {
    private pending: Promise<T> | null = null;

    run(request: () => Promise<T>): Promise<T> {
        if (this.pending) return this.pending;
        const pending = Promise.resolve().then(request).finally(() => {
            if (this.pending === pending) this.pending = null;
        });
        this.pending = pending;
        return pending;
    }
}

/** Keep timer/visibility events from overlapping or hammering a failed relay. */
export class PresencePublishGate {
    private inFlight = false;
    private failures = 0;
    private retryAt = 0;

    tryBegin(now: number): boolean {
        if (this.inFlight || now < this.retryAt) return false;
        this.inFlight = true;
        return true;
    }

    succeed(): void {
        this.inFlight = false;
        this.failures = 0;
        this.retryAt = 0;
    }

    fail(now: number): void {
        this.inFlight = false;
        this.failures = Math.min(this.failures + 1, 4);
        this.retryAt = now + Math.min(60_000 * 2 ** (this.failures - 1), 300_000);
    }
}
