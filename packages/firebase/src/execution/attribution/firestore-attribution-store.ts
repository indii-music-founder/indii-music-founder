/**
 * FirestoreAttributionDeduplicationStore — Layer 3 (Execution)
 *
 * Production Firestore-backed implementation of `AttributionDeduplicationStore`.
 * Persists conversion fan-out receipts under a configurable Firestore collection
 * (default: `marketingAttributionReceipts/{eventId}`) so server-side conversion
 * events (Meta CAPI, TikTok Events API, Google Enhanced Conversions) are
 * durably deduplicated across serverless cold starts and concurrent retries.
 */

import * as admin from 'firebase-admin';
import {
    type AttributionDeduplicationStore,
    type AttributionFanOutReceipt,
} from './attribution-bus';

export interface FirestoreLikeDocRef {
    get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
    create?(data: Record<string, unknown>): Promise<unknown>;
}

export interface FirestoreLikeCollection {
    doc(id: string): FirestoreLikeDocRef;
}

export interface FirestoreLikeDb {
    collection(name: string): FirestoreLikeCollection;
}

export class FirestoreAttributionDeduplicationStore implements AttributionDeduplicationStore {
    private readonly dbResolver: () => FirestoreLikeDb;
    private readonly collectionName: string;

    constructor(options?: {
        db?: FirestoreLikeDb;
        collectionName?: string;
    }) {
        this.dbResolver = options?.db
            ? () => options.db!
            : () => admin.firestore() as unknown as FirestoreLikeDb;
        this.collectionName = options?.collectionName ?? 'marketingAttributionReceipts';
    }

    private sanitizeId(eventId: string): string {
        return eventId.trim().replace(/\//g, '_');
    }

    async hasProcessed(eventId: string): Promise<boolean> {
        const docId = this.sanitizeId(eventId);
        if (!docId) return false;

        const snapshot = await this.dbResolver()
            .collection(this.collectionName)
            .doc(docId)
            .get();

        return snapshot.exists;
    }

    async markProcessed(eventId: string, receipt: AttributionFanOutReceipt): Promise<void> {
        const docId = this.sanitizeId(eventId);
        if (!docId) return;

        const docRef = this.dbResolver().collection(this.collectionName).doc(docId);
        const record: Record<string, unknown> = {
            eventId: receipt.eventId,
            eventName: receipt.eventName,
            releaseId: receipt.releaseId,
            isrc: receipt.isrc,
            deduplicated: receipt.deduplicated,
            dispatchedAtIso: receipt.dispatchedAtIso,
            results: receipt.results,
        };

        if (typeof docRef.create === 'function') {
            try {
                await docRef.create(record);
                return;
            } catch {
                // Document already created by a concurrent worker; idempotent no-op.
                return;
            }
        }

        await docRef.set(record, { merge: true });
    }
}
