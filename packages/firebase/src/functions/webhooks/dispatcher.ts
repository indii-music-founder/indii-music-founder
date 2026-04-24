/**
 * WebhookDispatcher — Deliver webhook events with retry logic
 *
 * Features:
 * - HMAC-SHA256 signature verification
 * - Exponential backoff retry (3 attempts)
 * - Dead letter queue for failed webhooks
 * - Event deduplication with idempotency keys
 */

import * as functions from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

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
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  attempt: number;
  maxAttempts: number;
  nextRetry?: string;
  error?: string;
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
function verifySignature(secret: string, signature: string, payload: string): boolean {
  const expected = generateSignature(secret, payload);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
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
        'X-IndiiOS-Signature': signature,
        'X-IndiiOS-Event-ID': event.eventId,
        'X-IndiiOS-Event-Type': event.eventType,
        'X-IndiiOS-Timestamp': event.timestamp,
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
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown error';
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
  await db.collection('webhook_queue').doc(event.eventId).update({
    attempt: event.attempt + 1,
    nextRetry,
    error: null,
  });
  console.log(`[WebhookDispatcher] Scheduled retry for ${event.eventId} in ${backoffMs}ms`);
}

/**
 * Mark webhook as failed (dead letter)
 */
async function markFailed(
  event: WebhookEvent,
  reason: string
): Promise<void> {
  await db.collection('webhook_deadletter').doc(event.eventId).set({
    ...event,
    failedAt: new Date().toISOString(),
    reason,
  });
  await db.collection('webhook_queue').doc(event.eventId).delete();
  console.error(`[WebhookDispatcher] Webhook ${event.eventId} moved to dead letter: ${reason}`);
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
    await db.collection('webhook_queue').doc(event.eventId).delete();
    console.log(`[WebhookDispatcher] Webhook ${event.eventId} delivered successfully`);
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
export const sendWebhookOnEvent = functions.firestore
  .onDocumentCreated('events/{eventId}', async (change) => {
    try {
      const eventData = change.data?.data();
      if (!eventData) return;

      const userId = eventData.userId;
      const eventType = eventData.eventType;

      // Find webhooks subscribed to this event type
      const webhookSnapshot = await db
        .collection('users').doc(userId).collection('webhooks')
        .where('active', '==', true)
        .where('events', 'array-contains', eventType)
        .get();

      if (webhookSnapshot.empty) {
        console.log(`[WebhookDispatcher] No webhooks for event type: ${eventType}`);
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
          eventType,
          payload: eventData.data || {},
          timestamp: new Date().toISOString(),
          attempt: 0,
          maxAttempts: 3,
        });
      });

      // Batch insert webhook events to queue
      const batch = db.batch();
      webhookEvents.forEach(we => {
        batch.set(db.collection('webhook_queue').doc(we.eventId), we);
      });
      await batch.commit();

      console.log(`[WebhookDispatcher] Queued ${webhookEvents.length} webhooks`);
    } catch (err) {
      console.error('[WebhookDispatcher] Event trigger failed:', err);
    }
  });

/**
 * Scheduled function: Process webhook queue every 30 seconds
 */
export const processWebhookQueue = functions.scheduler.onSchedule(
  {
    schedule: 'every 30 seconds',
    timeoutSeconds: 300,
    memory: '256MB',
  },
  async () => {
    try {
      const now = new Date().toISOString();

      // Get pending webhooks (no nextRetry or nextRetry in past)
      const snapshot = await db
        .collection('webhook_queue')
        .where('nextRetry', '<=', now)
        .limit(50)
        .get();

      if (snapshot.empty) {
        console.log('[WebhookDispatcher] No webhooks to process');
        return;
      }

      for (const doc of snapshot.docs) {
        const event = doc.data() as WebhookEvent;

        const webhook = await db
          .collection('users').doc(event.webhookId.split('-')[0])
          .collection('webhooks').doc(event.webhookId)
          .get();

        if (!webhook.exists) {
          await db.collection('webhook_queue').doc(doc.id).delete();
          console.warn(`[WebhookDispatcher] Webhook not found: ${event.webhookId}`);
          continue;
        }

        const webhookData = webhook.data() as Webhook;
        if (!webhookData.active) {
          await db.collection('webhook_queue').doc(doc.id).delete();
          continue;
        }

        await processWebhookDelivery(event, webhookData);
      }
    } catch (err) {
      console.error('[WebhookDispatcher] Queue processing failed:', err);
    }
  }
);

/**
 * HTTP endpoint: Create webhook subscription
 */
export const createWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const { userId, url, secret, events } = req.body;

    if (!userId || !url || !secret || !Array.isArray(events)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const webhookId = db.collection('_').doc().id;
    const webhook: Webhook = {
      id: webhookId,
      userId,
      url,
      secret,
      events,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userId).collection('webhooks').doc(webhookId).set(webhook);
    res.status(201).json({ id: webhookId, ...webhook });
  } catch (err) {
    console.error('[WebhookDispatcher] Create webhook failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
