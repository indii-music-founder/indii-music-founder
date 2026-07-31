/**
 * conversionEventOutbox — the only sanctioned writer of conversion events.
 *
 * ── Why an outbox and not a direct INSERT ───────────────────────────────────
 *
 * The obvious implementation is to INSERT into ClickHouse from whatever
 * function observed the event. That is wrong here for three independent
 * reasons, and each one alone is disqualifying:
 *
 *  1. **Latency.** The biggest event source is the smart-link redirect, where
 *     a fan is staring at a blank tab waiting to reach Spotify. Putting a
 *     cross-region warehouse round-trip in that path spends the fan's patience
 *     on our analytics.
 *
 *  2. **Availability.** A warehouse outage would become a *fan-facing* outage,
 *     or — worse — we would swallow the error and silently lose the events
 *     that the entire optimizer depends on. Firestore is the durable buffer
 *     that makes warehouse downtime invisible and recoverable.
 *
 *  3. **ClickHouse itself.** MergeTree creates a new data part per INSERT and
 *     merges them in the background. Thousands of single-row inserts produce
 *     part explosion, merge pressure, and eventually `TOO_MANY_PARTS`
 *     rejections. ClickHouse wants few, large inserts. Batching is not an
 *     optimization here; it is the supported way to write to this engine.
 *
 * So: append here (fast, durable, idempotent), and let `flushConversionEvents`
 * drain the buffer into the warehouse in batches.
 *
 * ── Idempotency ─────────────────────────────────────────────────────────────
 * The Firestore document id *is* the event id. Cloud Scheduler, Inngest, and
 * Meta webhooks all retry; re-enqueueing an already-enqueued event overwrites
 * an identical row rather than inflating an artist's conversion count.
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { ConversionEventSchema, type ConversionEvent } from '@indii/shared';

/** Top-level, server-only. No client may read or write it — see firestore.rules. */
export const OUTBOX_COLLECTION = 'conversionEventOutbox';

export type OutboxStatus = 'pending' | 'flushed';

export interface OutboxRecord extends ConversionEvent {
    status: OutboxStatus;
    enqueuedAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
    flushedAt?: admin.firestore.FieldValue | admin.firestore.Timestamp;
    /** Incremented when a flush attempt fails, for poison-message triage. */
    flushAttempts: number;
}

function db(): admin.firestore.Firestore {
    return admin.firestore();
}

/**
 * Appends one conversion event to the outbox.
 *
 * **Never throws.** Every caller is on a path where the fan-facing work
 * already succeeded — the redirect fired, the pre-save was authorized, the
 * order was placed. Losing analytics is bad; failing the fan's action because
 * analytics failed is worse. Failures are logged loudly and swallowed.
 *
 * Returns whether the event was durably enqueued, so latency-tolerant callers
 * can react if they want to. Latency-critical ones should ignore it.
 */
export async function enqueueConversionEvent(event: ConversionEvent): Promise<boolean> {
    const parsed = ConversionEventSchema.safeParse(event);
    if (!parsed.success) {
        // A malformed event is a programming error, not a runtime condition.
        // Log the issues rather than the payload — events carry fan data.
        logger.error('[conversionEventOutbox] Rejected malformed event', {
            eventId: event?.eventId,
            issues: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
        });
        return false;
    }

    try {
        await db().collection(OUTBOX_COLLECTION).doc(parsed.data.eventId).set(
            {
                ...parsed.data,
                status: 'pending' satisfies OutboxStatus,
                enqueuedAt: admin.firestore.FieldValue.serverTimestamp(),
                flushAttempts: 0,
            },
            // merge:false — a re-enqueue of the same natural event should
            // reset it to pending rather than layer onto a half-flushed row.
            { merge: false },
        );
        return true;
    } catch (error) {
        logger.error('[conversionEventOutbox] Enqueue failed', {
            eventId: parsed.data.eventId,
            artistId: parsed.data.artistId,
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/**
 * Fire-and-forget enqueue for latency-critical paths.
 *
 * The smart-link redirect must not await a Firestore write before sending the
 * fan onward. Cloud Functions can freeze a container once the response is
 * returned, so this is best-effort by construction: callers that genuinely
 * cannot lose an event (a sale, a pre-save) must `await enqueueConversionEvent`
 * instead and accept the latency.
 */
export function enqueueConversionEventDetached(event: ConversionEvent): void {
    void enqueueConversionEvent(event).catch(() => { /* already logged */ });
}
