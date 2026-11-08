import * as admin from 'firebase-admin';

export const DEFAULT_BATCH_CHUNK_SIZE = 400; // Well below Firestore's 500-write limit

/**
 * ChunkedBatch
 *
 * Automatically flushes Firestore WriteBatches when they reach chunk size (default: 400),
 * preventing Firestore INVALID_ARGUMENT crashes on unbounded scheduled cron jobs.
 */
export class ChunkedBatch {
    private db: FirebaseFirestore.Firestore;
    private batchSize: number;
    private currentBatch: FirebaseFirestore.WriteBatch;
    private pendingCount: number = 0;
    private totalCommitted: number = 0;

    constructor(db?: FirebaseFirestore.Firestore, batchSize: number = DEFAULT_BATCH_CHUNK_SIZE) {
        this.db = db || admin.firestore();
        this.batchSize = batchSize;
        this.currentBatch = this.db.batch();
    }

    async set<T extends FirebaseFirestore.DocumentData>(
        ref: FirebaseFirestore.DocumentReference<T>,
        data: FirebaseFirestore.WithFieldValue<T>,
        options?: FirebaseFirestore.SetOptions
    ): Promise<void> {
        if (options) {
            this.currentBatch.set(ref, data, options);
        } else {
            this.currentBatch.set(ref, data);
        }
        this.pendingCount++;
        if (this.pendingCount >= this.batchSize) {
            await this.flush();
        }
    }

    async update(
        ref: FirebaseFirestore.DocumentReference,
        data: FirebaseFirestore.UpdateData<Record<string, unknown>>
    ): Promise<void> {
        this.currentBatch.update(ref, data);
        this.pendingCount++;
        if (this.pendingCount >= this.batchSize) {
            await this.flush();
        }
    }

    async delete(ref: FirebaseFirestore.DocumentReference): Promise<void> {
        this.currentBatch.delete(ref);
        this.pendingCount++;
        if (this.pendingCount >= this.batchSize) {
            await this.flush();
        }
    }

    private async flush(): Promise<void> {
        if (this.pendingCount > 0) {
            await this.currentBatch.commit();
            this.totalCommitted += this.pendingCount;
            this.currentBatch = this.db.batch();
            this.pendingCount = 0;
        }
    }

    async commit(): Promise<{ totalWrites: number }> {
        const remaining = this.pendingCount;
        await this.flush();
        return { totalWrites: this.totalCommitted };
    }
}
