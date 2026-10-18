export type ArtworkSaveStatus = 'unsaved' | 'saving' | 'saved' | 'error';

/** Scheduling only: ownership and real persistence stay in the document service. */
export class ArtworkWriteQueue<T> {
    private latest: { value: T; version: number } | null = null;
    private acknowledged: number | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private operation: Promise<void> | null = null;
    private followLatest = false;
    private readyVersion: number | null = null;

    constructor(
        private write: (value: T) => Promise<void>,
        private observe: (status: ArtworkSaveStatus, failure?: unknown) => void = () => undefined,
        private delay = 2000,
    ) {}
    setObserver(observe: (status: ArtworkSaveStatus, failure?: unknown) => void): void { this.observe = observe; }
    update(value: T, version: number): void {
        this.cancelTimer(); this.readyVersion = null;
        this.latest = { value, version };
        if (version === this.acknowledged) { this.observe('saved'); return; }
        this.observe(this.operation ? 'saving' : 'unsaved');
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush(false).catch(() => undefined);
        }, this.delay);
    }
    cancelTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }
    /** Explicit Save/Close follows edits made during the pending write. */
    flush(followLatest = true): Promise<void> {
        this.cancelTimer();
        if (followLatest) this.followLatest = true;
        else this.readyVersion = this.latest?.version ?? null;
        if (this.operation) return this.operation;
        if (!this.latest || this.latest.version === this.acknowledged) {
            this.followLatest = false; this.readyVersion = null;
            return Promise.resolve();
        }
        const operation = Promise.resolve().then(async () => {
            try {
                do {
                    const snapshot = this.latest!;
                    this.readyVersion = null;
                    this.observe('saving');
                    await this.write(snapshot.value);
                    this.acknowledged = snapshot.version;
                } while (this.latest && this.latest.version !== this.acknowledged && (this.followLatest || this.readyVersion === this.latest.version));
                this.observe(this.latest?.version === this.acknowledged ? 'saved' : 'unsaved');
            } catch (failure) {
                this.observe('error', failure);
                throw failure;
            }
        });
        this.operation = operation;
        const finish = () => { if (this.operation === operation) { this.operation = null; this.followLatest = false; this.readyVersion = null; } };
        void operation.then(finish, finish);
        return operation;
    }
}
