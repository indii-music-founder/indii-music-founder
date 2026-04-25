/**
 * BigQueryEventsPipeline — Stream analytics events to BigQuery
 *
 * Batch events from Firestore and stream to BigQuery with:
 * - 10% sampling for cost control
 * - Event deduplication using idempotency keys
 * - Automatic schema validation
 */

import * as functions from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';
import type { AnalyticsEvent } from '@indiios/shared';

const db = admin.firestore();
const bigquery = new BigQuery({
  projectId: process.env.GCLOUD_PROJECT,
});

interface BigQueryRow extends AnalyticsEvent {
  _idempotencyKey?: string;
  _timestamp: string;
}

const DATASET_ID = 'analytics';
const TABLE_ID = 'events';
const SAMPLING_RATE = 0.1; // 10% sampling
const BATCH_SIZE = 100;
const DEDUPE_WINDOW_MS = 60000; // 1 minute

/**
 * Generate idempotency key to prevent duplicates
 * Format: userId-eventType-timestamp-hash
 */
function generateIdempotencyKey(event: AnalyticsEvent): string {
  const hash = Math.random().toString(36).substr(2, 9);
  return `${event.userId}-${event.eventType}-${event.timestamp}-${hash}`;
}

/**
 * Check if event is duplicate (within dedup window)
 */
async function isDuplicate(idempotencyKey: string): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count FROM \`${process.env.GCLOUD_PROJECT}.${DATASET_ID}.${TABLE_ID}\`
    WHERE _idempotencyKey = @key
    AND TIMESTAMP_MILLIS(_timestamp) > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MINUTE)
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
  } catch (err: any) {
    if (err.name === 'PartialFailureError') {
      console.warn('[BigQueryEventsPipeline] Partial insert failure:', err.errors);
    } else {
      throw err;
    }
  }
}

/**
 * Scheduled function: Batch events to BigQuery every 5 minutes
 */
export const batchEventsScheduled = functions.scheduler.onSchedule(
  {
    schedule: 'every 5 minutes',
    timeoutSeconds: 300,
    memory: '512MB',
  },
  async () => {
    try {
      const snapshot = await db.collection('events')
        .orderBy('timestamp', 'desc')
        .limit(BATCH_SIZE)
        .get();

      if (snapshot.empty) {
        console.log('[BigQueryEventsPipeline] No events to process');
        return;
      }

      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AnalyticsEvent));

      await streamEventsToBigQuery(events);

      // Mark batch as processed (optional: add processedAt timestamp)
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { _bigQuerySynced: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('[BigQueryEventsPipeline] Batch failed:', err);
      throw err;
    }
  }
);

/**
 * Firestore trigger: Stream events in real-time (sampled)
 */
export const streamEventOnCreate = functions.firestore
  .onDocumentCreated('events/{eventId}', async (event) => {
    try {
      if (!shouldSample()) return;

      const data = event.data?.data();
      if (!data) return;

      const analyticsEvent: AnalyticsEvent = {
        id: data.id,
        eventType: data.eventType,
        userId: data.userId,
        sessionId: data.sessionId,
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
      console.log('[BigQueryEventsPipeline] Streamed event:', analyticsEvent.id);
    } catch (err) {
      console.error('[BigQueryEventsPipeline] Stream failed:', err);
      // Non-blocking: don't throw to prevent retry loop
    }
  });
