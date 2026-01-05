/**
 * Generic request batcher that pools items over a time window or until a size limit is reached.
 */
export class RequestBatcher<T, R> {
    private queue: { item: T; resolve: (value: R) => void; reject: (reason?: any) => void }[] = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(
        private processor: (items: T[]) => Promise<R[]>,
        private options: { maxBatchSize: number; maxWaitMs: number }
    ) { }

    /**
     * Add an item to the batch queue.
     * @param item The item to process
     * @returns A promise that resolves with the result for this specific item
     */
    add(item: T): Promise<R> {
        return new Promise((resolve, reject) => {
            this.queue.push({ item, resolve, reject });
            this.checkQueue();
        });
    }

    private checkQueue() {
        if (this.queue.length >= this.options.maxBatchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.options.maxWaitMs);
        }
    }

    private async flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.queue.length === 0) return;

        // Take a batch off the queue
        const batch = this.queue.splice(0, this.options.maxBatchSize);
        const items = batch.map(b => b.item);

        try {
            const results = await this.processor(items);
            if (results.length !== batch.length) {
                // If the processor returns the wrong number of results, we can't map them back to requests safely.
                // Fail the whole batch to be safe.
                throw new Error(`Batch result count mismatch: expected ${batch.length}, got ${results.length}`);
            }
            batch.forEach((b, i) => b.resolve(results[i]));
        } catch (error) {
            batch.forEach(b => b.reject(error));
        }
    }
}
