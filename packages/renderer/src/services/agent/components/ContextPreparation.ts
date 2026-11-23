import { Logger } from '@/core/logger/Logger';

/**
 * A context read ran out of time. The message is what the artist sees, so it
 * stays plain; the internal stage name is kept on `stage` and in the log.
 */
export class ContextPreparationTimeout extends Error {
    constructor(readonly stage: string) {
        super('Getting this reply ready took too long. Please send your message again.');
        this.name = 'ContextPreparationTimeout';
    }
}

/** One deadline for context reads; cancellation never admits a late result. */
export class ContextPreparation {
    private readonly startedAt: number;
    private readonly deadline: number;
    private failure: Error | undefined;
    /** ISSUE-1710: milliseconds since start at which each stage finished, so a timeout names what used the budget. */
    private readonly marks: Record<string, number> = {};

    constructor(private readonly signal?: AbortSignal, timeoutMs = 30_000) {
        this.startedAt = Date.now();
        this.deadline = this.startedAt + timeoutMs;
    }

    /** Record that a stage finished (or gave up) now. */
    mark(stage: string): void {
        this.marks[stage] = Date.now() - this.startedAt;
    }

    /** Stage finish times in milliseconds since the start, plus the total so far. */
    timings(): Record<string, number> {
        return { ...this.marks, elapsedMs: Date.now() - this.startedAt };
    }

    throwIfStopped(): void {
        this.signal?.throwIfAborted();
        if (this.failure) throw this.failure;
    }

    async wait<T>(stage: string, read: () => Promise<T>): Promise<T> {
        this.throwIfStopped();
        const remaining = this.deadline - Date.now();
        const timeout = () => {
            this.failure = new ContextPreparationTimeout(stage);
            Logger.warn('ContextPreparation', `Timed out during ${stage}`, this.timings());
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
            this.mark(stage);
            this.throwIfStopped();
            return value;
        } finally {
            clearTimeout(timer);
            if (abort) this.signal?.removeEventListener('abort', abort);
        }
    }
}
