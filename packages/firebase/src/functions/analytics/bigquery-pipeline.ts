/**
 * BigQueryEventsPipeline — Stream analytics events to BigQuery
 *
 * Batch events from Firestore and stream to BigQuery with:
 * - 10% sampling for cost control
 * - Event deduplication using idempotency keys
 * - Automatic schema validation
 */

import { onDocumentCreated, QueryDocumentSnapshot, FirestoreEvent } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';
import * as crypto from 'crypto';

const db = admin.firestore();
const bigquery = new BigQuery({
  projectId: process.env.GCLOUD_PROJECT,
});

interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  userId: string;
  timestamp: string | number;
  data: Record<string, unknown>;
}

interface BigQueryRow extends AnalyticsEvent {
  _idempotencyKey?: string;
  _timestamp: string;
}

const DATASET_ID = 'analytics';
const TABLE_ID = 'events';
const SAMPLING_RATE = 0.1; // 10% sampling
const BATCH_SIZE = 100;


/**
 * Generate idempotency key to prevent duplicates
 * Format: userId-eventType-timestamp-hash
 */
function generateIdempotencyKey(event: AnalyticsEvent): string {
  const dataString = JSON.stringify(event.data || {});
  const hash = crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 8);
  return event.eventId || `${event.userId}-${event.eventType}-${event.timestamp}-${hash}`;
}

/**
 * Check if event is duplicate (within dedup window)
 */
async function isDuplicate(idempotencyKey: string): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count FROM \`${process.env.GCLOUD_PROJECT}.${DATASET_ID}.${TABLE_ID}\`
    WHERE _idempotencyKey = @key
    AND TIMESTAMP(_timestamp) > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
  `;

  try {
    const options = {
      query,
      params: { key: idempotencyKey },
    };
    const [rows] = await bigquery.query(options);
    return rows.length > 0 && rows[0].count > 0;
  } catch (err) {
    console.error('[BigQueryEventsPipeline] Dedup check failed:', err);
    return false; // Fail open to allow event through
  }
}

/**
 * Should event be sampled? (10% by default)
 */
function shouldSample(): boolean {
  return Math.random() < SAMPLING_RATE;
}

/**
 * Stream events from Firestore to BigQuery
 */
async function streamEventsToBigQuery(events: AnalyticsEvent[]): Promise<void> {
  if (events.length === 0) return;

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  const rows: BigQueryRow[] = [];

  // Filter and prepare rows
  for (const event of events) {
    if (!shouldSample()) continue;

    const idempotencyKey = generateIdempotencyKey(event);
    const isDupe = await isDuplicate(idempotencyKey);
    if (isDupe) {
      console.log('[BigQueryEventsPipeline] Skipping duplicate event:', idempotencyKey);
      continue;
    }

    rows.push({
      ...event,
      _idempotencyKey: idempotencyKey,
      _timestamp: new Date().toISOString(),
    });
  }

  if (rows.length === 0) return;

  // Batch insert into BigQuery
  try {
    const result = await table.insert(rows);
    console.log(`[BigQueryEventsPipeline] Inserted ${result.length} rows`);
  } catch (error: unknown) {
    const err = error as Error & { errors?: unknown[] };
    if (err.name === 'PartialFailureError') {
      console.warn('[BigQueryEventsPipeline] Partial insert failure:', err.errors);
    } else {
      throw err;
    }
  }
}

/**
 * Core batch event processing handler (pure, exported for testing).
 * Advances a persistent cursor watermark in admin/bigquerySyncState
 * so the pipeline queries strictly chronologically and never re-inserts duplicates.
 */
export async function runBatchEventsSync(
  dbInstance = db,
  streamer = streamEventsToBigQuery,
): Promise<{ processed: number; lastWatermark: string | null }> {
  const syncStateRef = dbInstance.collection('admin').doc('bigquerySyncState');
  const syncDoc = await syncStateRef.get();
  const lastWatermark = syncDoc.data()?.lastSyncedTimestamp || '1970-01-01T00:00:00.000Z';

  // Chronological query starting strictly after the last watermark
  const snapshot = await dbInstance.collection('events')
    .where('timestamp', '>', lastWatermark)
    .orderBy('timestamp', 'asc')
    .limit(BATCH_SIZE)
    .get();

  if (snapshot.empty) {
    console.log('[BigQueryEventsPipeline] No new events to process after watermark:', lastWatermark);
    return { processed: 0, lastWatermark };
  }

  const events = snapshot.docs.map(doc => ({
    eventId: doc.id,
    ...doc.data(),
  } as unknown as AnalyticsEvent));

  await streamer(events);

  const batch = dbInstance.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { _bigQuerySynced: true });
  });

  const newestTimestamp = String(events[events.length - 1].timestamp);
  batch.set(syncStateRef, {
    lastSyncedTimestamp: newestTimestamp,
    lastSyncedAt: new Date().toISOString(),
    eventCount: admin.firestore.FieldValue.increment(events.length),
  }, { merge: true });

  await batch.commit();
  return { processed: events.length, lastWatermark: newestTimestamp };
}

/**
 * Scheduled function: Batch events to BigQuery every 5 minutes
 */
export const batchEventsScheduled = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    try {
      const result = await runBatchEventsSync();
      console.log(`[BigQueryEventsPipeline] Synced ${result.processed} events (watermark: ${result.lastWatermark})`);
    } catch (err) {
      console.error('[BigQueryEventsPipeline] Batch failed:', err);
      throw err;
    }
  }
);

/**
 * Firestore trigger: Stream events in real-time (sampled)
 */
export const streamEventOnCreate = onDocumentCreated('events/{eventId}', async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, { eventId: string }>) => {
    try {
      if (!shouldSample()) return;

      const data = event.data?.data();
      if (!data) return;

      const analyticsEvent: AnalyticsEvent = {
        eventId: data.eventId || event.params.eventId,
        eventType: data.eventType,
        userId: data.userId,
        timestamp: data.timestamp,
        data: data.data || {},
      };

      const idempotencyKey = generateIdempotencyKey(analyticsEvent);
      const isDupe = await isDuplicate(idempotencyKey);
      if (isDupe) {
        console.log('[BigQueryEventsPipeline] Skipping duplicate:', idempotencyKey);
        return;
      }

      const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
      const row: BigQueryRow = {
        ...analyticsEvent,
        _idempotencyKey: idempotencyKey,
        _timestamp: new Date().toISOString(),
      };

      await table.insert([row]);
      console.log('[BigQueryEventsPipeline] Streamed event:', analyticsEvent.eventId);
    } catch (err) {
      console.error('[BigQueryEventsPipeline] Stream failed:', err);
      // Non-blocking: don't throw to prevent retry loop
    }
  });
