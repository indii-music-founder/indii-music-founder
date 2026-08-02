/**
 * flushConversionEvents — drains the conversion outbox into ClickHouse.
 *
 * Runs on a schedule rather than a Firestore trigger, because the whole point
 * of the outbox is to write to the warehouse in batches (see
 * `conversionEventOutbox` for why MergeTree requires this). A per-document
 * trigger would reintroduce exactly the single-row inserts the outbox exists
 * to avoid.
 *
 * ── Delivery semantics: at-least-once transport, exactly-once effect ────────
 * The insert and the "mark flushed" write span two systems and cannot be made
 * atomic. This orders them insert-first, so a crash in between re-sends rows
 * on the next tick rather than losing them — losing a conversion silently
 * corrupts every downstream optimization decision, while re-sending one is
 * recoverable.
 *
 * Re-sending is then made harmless by filtering event_ids already present in
 * the warehouse before each insert. That filter is required, not belt-and-
 * braces: `daily_ad_performance_mv` is a materialized view, and materialized
 * views fire per *insert block*, before ReplacingMergeTree has collapsed
 * anything. A duplicate that reaches the base table is deduped there
 * eventually but double-counts in the rollup permanently — and the rollup is
 * what the artist's ROAS chart and the optimizer both read.
 *
 * ReplacingMergeTree on event_id remains as a second line of defence for rows
 * that slip past the filter (two flushers racing the same batch).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import type { ConversionEvent } from '@indii/shared';
import { OUTBOX_COLLECTION, type OutboxStatus } from './conversionEventOutbox';
import {
    WAREHOUSE_SECRETS, WAREHOUSE_WRITER_SECRETS, insertWarehouseRows, queryWarehouse,
} from './clickhouseClient';
import { sendConversions } from './metaConversionsApi';

const EVENTS_TABLE = 'indii_analytics.omnichannel_events';

/**
 * Rows per flush. Large enough that MergeTree gets healthy part sizes, small
 * enough to stay inside the function's memory and timeout budget.
 */
const BATCH_SIZE = 500;

/**
 * A row that has failed this many times is poison — a shape the warehouse will
 * never accept. It stays in the outbox for triage but stops blocking the queue
 * behind it.
 */
const MAX_FLUSH_ATTEMPTS = 5;

/** Minor units (cents) → the Decimal(18,4) the warehouse column expects. */
function minorToDecimalString(minor: number): string {
    return (minor / 100).toFixed(4);
}

/**
 * Projects the transport shape onto the warehouse column names.
 *
 * The rename is deliberate and one-way: the schema is camelCase because it is
 * a TypeScript contract; the warehouse is snake_case because it is SQL. Doing
 * the mapping in exactly one place means a column rename is a one-line change
 * rather than a search across every producer.
 */
export function toWarehouseRow(event: ConversionEvent): Record<string, unknown> {
    return {
        event_id: event.eventId,
        artist_id: event.artistId,
        platform: event.platform,
        event_type: event.eventType,
        // ClickHouse DateTime64 accepts 'YYYY-MM-DD hh:mm:ss.sss'; ISO's 'T'
        // and trailing 'Z' are not parsed by the JSONEachRow reader.
        event_time: event.occurredAt.replace('T', ' ').replace('Z', ''),
        revenue: minorToDecimalString(event.revenueMinor),
        cost: minorToDecimalString(event.costMinor),
        listen_duration_seconds: 0,
        campaign_id: event.campaignId,
        ad_creative_id: event.adCreativeId,
        utm_source: event.utmSource,
        utm_medium: event.utmMedium,
        raw_metadata: JSON.stringify({
            ...event.metadata,
            currency: event.currency,
            smartLinkSlug: event.smartLinkSlug,
            utmCampaign: event.utmCampaign,
        }),
    };
}

/**
 * Returns the subset of `eventIds` already present in the warehouse.
 *
 * One SELECT per flush, keyed on the batch's ids. This is what makes an
 * at-least-once transport safe for a materialized view that cannot tolerate
 * duplicates.
 */
export async function findAlreadyInsertedIds(eventIds: readonly string[]): Promise<Set<string>> {
    if (eventIds.length === 0) return new Set();

    const rows = await queryWarehouse<{ event_id: string }>(
        `SELECT DISTINCT event_id FROM ${EVENTS_TABLE} WHERE event_id IN {ids:Array(String)}`,
        { ids: { type: 'Array(String)', value: eventIds } },
    );

    return new Set(rows.map(row => row.event_id));
}

/**
 * Fetch Instagram pixel credentials for an artist from their analyticsTokens.
 * Returns [pixelId, accessToken] or null if not configured.
 */
async function getInstagramPixelCredentials(
    userId: string,
): Promise<[pixelId: string, accessToken: string] | null> {
    const db = admin.firestore();
    try {
        const snap = await db.collection('users').doc(userId).collection('analyticsTokens').doc('instagram').get();
        if (!snap.exists) return null;

        const data = snap.data();
        const pixelId = data?.pixel_id;
        const accessToken = data?.access_token;

        if (!pixelId || !accessToken) return null;
        return [pixelId, accessToken];
    } catch (error) {
        logger.warn('[getInstagramPixelCredentials] Failed to fetch credentials', {
            userId: userId.substring(0, 8),
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * Core flush routine, exported so tests can drive it without the scheduler.
 * Returns how many rows reached the warehouse.
 */
export async function flushOutboxBatch(): Promise<number> {
    const db = admin.firestore();

    const pending = await db.collection(OUTBOX_COLLECTION)
        .where('status', '==', 'pending' satisfies OutboxStatus)
        .where('flushAttempts', '<', MAX_FLUSH_ATTEMPTS)
        .limit(BATCH_SIZE)
        .get();

    if (pending.empty) return 0;

    const docs = pending.docs;
    let fresh: typeof docs = [];

    try {
        // Drop anything a previous crashed flush already landed. Doing this
        // before the insert keeps duplicates out of the materialized view,
        // which cannot un-count them later.
        const alreadyInserted = await findAlreadyInsertedIds(docs.map(doc => doc.id));
        fresh = docs.filter(doc => !alreadyInserted.has(doc.id));

        if (alreadyInserted.size > 0) {
            logger.info('[flushConversionEvents] Skipped rows already in the warehouse', {
                skipped: alreadyInserted.size, batchSize: docs.length,
            });
        }

        const rows = fresh.map(doc => toWarehouseRow(doc.data() as ConversionEvent));
        await insertWarehouseRows(EVENTS_TABLE, rows);
    } catch (error) {
        // Bump attempt counters so a permanently-bad row eventually stops
        // blocking the queue, and leave everything else pending for retry.
        const failure = db.batch();
        for (const doc of docs) {
            failure.update(doc.ref, { flushAttempts: admin.firestore.FieldValue.increment(1) });
        }
        await failure.commit().catch(commitError => {
            logger.error('[flushConversionEvents] Could not record flush failure', {
                error: commitError instanceof Error ? commitError.message : String(commitError),
            });
        });

        logger.error('[flushConversionEvents] Warehouse insert failed; rows remain pending', {
            rowCount: docs.length,
            error: error instanceof Error ? error.message : String(error),
        });
        return 0;
    }

    // Insert succeeded. Marking flushed is now best-effort: if this write
    // fails, the next tick re-sends and the warehouse dedups.
    const settled = db.batch();
    for (const doc of docs) {
        settled.update(doc.ref, {
            status: 'flushed' satisfies OutboxStatus,
            flushedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await settled.commit();

    // Send conversions to Meta (Conversions API) — non-blocking reporting.
    // Group events by artistId and send each artist's batch to their pixel.
    // Failures are logged but do not fail the flush: the warehouse write is
    // authoritative, and Meta's optimization is best-effort feedback.
    try {
        const eventsByArtist = new Map<string, typeof fresh>();
        for (const doc of fresh) {
            const event = doc.data() as ConversionEvent;
            const artistEvents = eventsByArtist.get(event.artistId) ?? [];
            artistEvents.push(doc);
            eventsByArtist.set(event.artistId, artistEvents);
        }

        for (const [artistId, artistDocs] of eventsByArtist) {
            const credentials = await getInstagramPixelCredentials(artistId);
            if (!credentials) {
                logger.info('[flushConversionEvents] Artist not configured for Conversions API', {
                    artistId: artistId.substring(0, 8),
                });
                continue;
            }

            const [pixelId, accessToken] = credentials;
            const events = artistDocs.map(doc => ({ event: doc.data() as ConversionEvent }));
            const sentCount = await sendConversions(pixelId, accessToken, events);
            logger.info('[flushConversionEvents] Sent conversions to Meta', {
                artistId: artistId.substring(0, 8),
                pixelId,
                eventCount: events.length,
                sentCount,
            });
        }
    } catch (metaError) {
        logger.warn('[flushConversionEvents] Conversions API send failed (non-blocking)', {
            error: metaError instanceof Error ? metaError.message : String(metaError),
        });
    }

    logger.info('[flushConversionEvents] Flushed batch', { rowCount: docs.length });
    return docs.length;
}

export const flushConversionEvents = onSchedule(
    {
        // Every five minutes. The optimizer reasons over daily rollups, so
        // fresher than this buys nothing and costs warehouse part pressure.
        schedule: 'every 5 minutes',
        // Both roles: the read-only role for the pre-insert dedup check, the
        // INSERT-only role for the write itself. Neither can do the other's job.
        secrets: Array.from(new Set([...WAREHOUSE_SECRETS, ...WAREHOUSE_WRITER_SECRETS])),
        timeoutSeconds: 300,
        memory: '512MiB',
    },
    async () => {
        try {
            await flushOutboxBatch();
        } catch (error) {
            logger.error('[flushConversionEvents] Flush tick failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    },
);
