/**
 * WebhookDispatcher — Deliver webhook events with retry logic
 *
 * Features:
 * - HMAC-SHA256 signature verification
 * - Exponential backoff retry (3 attempts)
 * - Dead letter queue for failed webhooks
 * - Event deduplication with idempotency keys
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as express from 'express';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

function maskId(id: string): string {
  if (!id) return '';
  return id.length > 4 ? `${id.slice(0, 4)}***` : '***';
}

// ISSUE-1393: lazily resolve Firestore inside each invocation. A module-top-
// level admin.firestore() runs at import time — index.ts imports this module,
// so any unit test that imports index.ts would hit an uninitialized admin
// during import. The function runtime always has admin ready.
function getDb() {
  return admin.firestore();
}

interface Webhook {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface WebhookEvent {
  eventId: string;
  webhookId: string;
  userId: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  attempt: number;
  maxAttempts: number;
  nextRetry?: string;
  error?: string;
  /** Claim lease set by processWebhookQueue so overlapping scheduled runs
   *  cannot double-deliver the same event. Absent/expired = claimable. */
  leaseUntil?: string;
}

/** Pure predicate for the queue claim decision (exported for tests). */
export function isQueueItemClaimable(
  data: Pick<WebhookEvent, 'leaseUntil'>,
  nowMs: number
): boolean {
  if (!data.leaseUntil) return true;
  return new Date(data.leaseUntil).getTime() <= nowMs;
}

/**
 * Generate HMAC-SHA256 signature for webhook
 */
function generateSignature(secret: string, payload: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifySignature(secret: string, signature: string, payload: string): boolean {
  const expected = generateSignature(secret, payload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Calculate exponential backoff delay (in milliseconds)
 * Attempt 0: 1s, Attempt 1: 2s, Attempt 2: 4s
 */
function getBackoffDelay(attempt: number): number {
  return Math.pow(2, attempt) * 1000;
}

/**
 * Deliver webhook to endpoint with timeout
 */
async function deliverWebhook(
  webhook: Webhook,
  event: WebhookEvent,
  payload: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const signature = generateSignature(webhook.secret, payload);
  const timeout = 10000; // 10 seconds

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-indii-Signature': signature,
        'X-indii-Event-ID': event.eventId,
        'X-indii-Event-Type': event.eventType,
        'X-indii-Timestamp': event.timestamp,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 2xx and 3xx are success
    if (response.status >= 200 && response.status < 400) {
      return { success: true, status: response.status };
    }

    // 4xx errors are not retryable
    if (response.status >= 400 && response.status < 500) {
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    // 5xx errors are retryable
    return {
      success: false,
      status: response.status,
      error: `HTTP ${response.status}`,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

/**
 * Schedule webhook retry
 */
async function scheduleRetry(
  event: WebhookEvent,
  backoffMs: number
): Promise<void> {
  const nextRetry = new Date(Date.now() + backoffMs).toISOString();
  await getDb().collection('webhook_queue').doc(event.eventId).update({
    attempt: event.attempt + 1,
    nextRetry,
    error: null,
  });
  logger.info(`[WebhookDispatcher] Scheduled retry for ${event.eventId} in ${backoffMs}ms`);
}

/**
 * Mark webhook as failed (dead letter)
 */
async function markFailed(
  event: WebhookEvent,
  reason: string
): Promise<void> {
  await getDb().collection('webhook_deadletter').doc(event.eventId).set({
    ...event,
    failedAt: new Date().toISOString(),
    reason,
  });
  await getDb().collection('webhook_queue').doc(event.eventId).delete();
  logger.error(`[WebhookDispatcher] Webhook ${event.eventId} moved to dead letter: ${reason}`);
}

/**
 * Process webhook delivery
 */
async function processWebhookDelivery(
  event: WebhookEvent,
  webhook: Webhook
): Promise<void> {
  const payload = JSON.stringify({
    id: event.eventId,
    type: event.eventType,
    data: event.payload,
    timestamp: event.timestamp,
  });

  const result = await deliverWebhook(webhook, event, payload);

  if (result.success) {
    await getDb().collection('webhook_queue').doc(event.eventId).delete();
    logger.info(`[WebhookDispatcher] Webhook ${event.eventId} delivered successfully`);
    return;
  }

  // Non-retryable 4xx errors
  if (result.status && result.status >= 400 && result.status < 500) {
    await markFailed(event, `${result.error} (non-retryable)`);
    return;
  }

  // Retryable errors
  if (event.attempt < event.maxAttempts - 1) {
    const backoffMs = getBackoffDelay(event.attempt);
    await scheduleRetry(event, backoffMs);
  } else {
    await markFailed(event, `Max retries exceeded: ${result.error}`);
  }
}

/**
 * Firestore trigger: Send webhook when event created
 */
export const sendWebhookOnEvent = onDocumentCreated('events/{eventId}', async (change) => {
    try {
      const eventData = change.data?.data();
      if (!eventData) return;

      const userId = eventData.userId;
      const eventType = eventData.eventType;

      // Find webhooks subscribed to this event type
      const webhookSnapshot = await getDb()
        .collection('users').doc(userId).collection('webhooks')
        .where('active', '==', true)
        .where('events', 'array-contains', eventType)
        .get();

      if (webhookSnapshot.empty) {
        logger.info(`[WebhookDispatcher] No webhooks for event type: ${eventType} and user: ${maskId(userId)}`);
        return;
      }

      // Queue webhook deliveries
      const webhookEvents: WebhookEvent[] = [];
      webhookSnapshot.docs.forEach(doc => {
        const webhook = doc.data() as Webhook;
        const eventId = `${change.data?.id}-${webhook.id}`;

        webhookEvents.push({
          eventId,
          webhookId: webhook.id,
          userId,
          eventType,
          payload: eventData.data || {},
          timestamp: new Date().toISOString(),
          attempt: 0,
          maxAttempts: 3,
          nextRetry: new Date().toISOString(),
        });
      });

      // Batch insert webhook events to queue
      const batch = getDb().batch();
      webhookEvents.forEach(we => {
        batch.set(getDb().collection('webhook_queue').doc(we.eventId), we);
      });
      await batch.commit();

      logger.info(`[WebhookDispatcher] Queued ${webhookEvents.length} webhooks for user ${maskId(userId)}`);
    } catch (err) {
      logger.error('[WebhookDispatcher] Event trigger failed:', err);
    }
  });

export interface WebhookTasksClientLike {
  queuePath(project: string, location: string, queue: string): string;
  createTask(request: {
    parent: string;
    task: {
      name?: string;
      dispatchDeadline?: { seconds: number };
      httpRequest: {
        httpMethod: 'POST';
        url: string;
        body: string;
        headers: Record<string, string>;
        oidcToken?: { serviceAccountEmail: string; audience: string };
      };
    };
  }): Promise<unknown>;
}

export interface WebhookTasksConfig {
  project: string;
  location: string;
  queue: string;
  workerUrl: string;
  serviceAccount?: string;
  audience?: string;
}

/**
 * Enqueue a webhook delivery task directly to Google Cloud Tasks.
 * Bypasses Firestore queue polling for instant sub-second delivery with native retries.
 */
export async function enqueueWebhookTask(
  event: WebhookEvent,
  client?: WebhookTasksClientLike,
  config?: WebhookTasksConfig,
): Promise<boolean> {
  const project = config?.project || process.env.GCLOUD_PROJECT || 'indii-music-founder';
  const location = config?.location || process.env.WEBHOOK_TASKS_LOCATION || 'us-central1';
  const queue = config?.queue || process.env.WEBHOOK_TASKS_QUEUE || 'webhook-delivery';
  const workerUrl = config?.workerUrl || process.env.WEBHOOK_WORKER_URL;

  if (!workerUrl || !client) {
    return false;
  }

  const parent = client.queuePath(project, location, queue);
  const taskName = `${parent}/tasks/webhook-${event.eventId}`;

  await client.createTask({
    parent,
    task: {
      name: taskName,
      httpRequest: {
        httpMethod: 'POST',
        url: `${workerUrl}/deliver`,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(event)).toString('base64'),
        ...(config?.serviceAccount && config?.audience ? {
          oidcToken: {
            serviceAccountEmail: config.serviceAccount,
            audience: config.audience,
          },
        } : {}),
      },
    },
  });

  return true;
}

/**
 * Scheduled function: Process webhook queue every 1 minute.
 * Serves as the fallback poller / dead-letter drain for webhooks in Firestore.
 */
export const processWebhookQueue = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    try {
      const now = new Date().toISOString();

      // Get pending webhooks (no nextRetry or nextRetry in past)
      const snapshot = await getDb()
        .collection('webhook_queue')
        .where('nextRetry', '<=', now)
        .limit(50)
        .get();

      if (snapshot.empty) {
        logger.info('[WebhookDispatcher] No webhooks to process');
        return;
      }

      const LEASE_MS = 2 * 60 * 1000;
      for (const doc of snapshot.docs) {
        // Atomic claim: overlapping scheduled runs (30s cadence, 300s timeout)
        // previously double-delivered webhooks. A transactional lease makes
        // the claim check-and-set atomic; expired leases are reclaimable.
        const leased = await getDb().runTransaction(async (tx) => {
          const ref = getDb().collection('webhook_queue').doc(doc.id);
          const snap = await tx.get(ref);
          if (!snap.exists) return false;
          const data = snap.data() as WebhookEvent;
          if (!isQueueItemClaimable(data, Date.now())) {
            return false; // another worker holds a live lease
          }
          tx.update(ref, { leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() });
          return true;
        });
        if (!leased) continue;

        // Fault isolation: one bad delivery must not abort the rest of the batch.
        try {
          await deliverQueuedWebhook(doc);
        } catch (err) {
          logger.error(`[WebhookDispatcher] Delivery for ${doc.id} failed unexpectedly:`, err);
        }
      }
    } catch (err) {
      logger.error('[WebhookDispatcher] Queue processing failed:', err);
    }
  }
);

/** Fetches the queue doc + webhook and runs a single delivery. */
async function deliverQueuedWebhook(doc: admin.firestore.QueryDocumentSnapshot): Promise<void> {
  const event = doc.data() as WebhookEvent;

  const webhook = await getDb()
    .collection('users').doc(event.userId)
    .collection('webhooks').doc(event.webhookId)
    .get();

  if (!webhook.exists) {
    await getDb().collection('webhook_queue').doc(doc.id).delete();
    logger.warn(`[WebhookDispatcher] Webhook not found: ${event.webhookId} for user ${maskId(event.userId)}`);
    return;
  }

  const webhookData = webhook.data() as Webhook;
  if (!webhookData.active) {
    await getDb().collection('webhook_queue').doc(doc.id).delete();
    return;
  }

  await processWebhookDelivery(event, webhookData);
}

/**
 * HTTP endpoint: Create webhook subscription
 */
export const createWebhook = onRequest(async (req: express.Request, res: express.Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
      return;
    }
    const token = authHeader.split('Bearer ')[1]!;
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { url, secret, events } = req.body;

    if (!url || !secret || !Array.isArray(events)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const webhookId = getDb().collection('_').doc().id;
    const webhook: Webhook = {
      id: webhookId,
      userId,
      url,
      secret,
      events,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await getDb().collection('users').doc(userId).collection('webhooks').doc(webhookId).set(webhook);
    res.status(201).json({ ...webhook, id: webhookId });
  } catch (err) {
    logger.error('[WebhookDispatcher] Create webhook failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
