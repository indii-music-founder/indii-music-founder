/** One deadline for context reads; cancellation never admits a late result. */
export class ContextPreparation {
    private readonly deadline: number;
    private failure: Error | undefined;

    constructor(private readonly signal?: AbortSignal, timeoutMs = 30_000) {
        this.deadline = Date.now() + timeoutMs;
    }

    throwIfStopped(): void {
        this.signal?.throwIfAborted();
        if (this.failure) throw this.failure;
    }

    async wait<T>(stage: string, read: () => Promise<T>): Promise<T> {
        this.throwIfStopped();
        const remaining = this.deadline - Date.now();
        const timeout = () => {
            this.failure = new Error(`Context preparation timed out during ${stage}. Please retry.`);
            return this.failure;
        };
        if (remaining <= 0) throw timeout();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let abort: (() => void) | undefined;
        const interrupted = new Promise<never>((_, reject) => {
            abort = () => reject(this.signal?.reason);
            this.signal?.addEventListener('abort', abort, { once: true });
            timer = setTimeout(() => reject(timeout()), remaining);
        });
        try {
            const value = await Promise.race([read(), interrupted]);
            this.throwIfStopped();
            return value;
        } finally {
            clearTimeout(timer);
            if (abort) this.signal?.removeEventListener('abort', abort);
        }
    }
}
