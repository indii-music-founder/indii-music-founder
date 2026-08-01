/**
 * Shopify Webhook Handler — Sales Conversion Attribution
 *
 * Handles Shopify order webhooks to emit sale conversion events.
 * Verifies HMAC-SHA256 signature with timing-safe comparison.
 *
 * HMAC verification:
 * - X-Shopify-Hmac-SHA256 header contains base64-encoded HMAC
 * - Payload is raw request body (JSON string)
 * - Secret from environment or Firebase secrets
 *
 * Endpoint: POST /shopifyWebhook
 * Shopify Webhooks: https://shopify.dev/api/admin-rest/2024-01/resources/webhook
 */

import * as crypto from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { shopifyWebhookSecret } from '../config/secrets';
import { enqueueConversionEvent } from './conversionEventOutbox';
import { buildConversionEventId } from '@indii/shared';

const REGION = 'us-central1';
const WEBHOOK_TIMEOUT = 30;

interface ShopifyOrder {
  id: string;
  order_number: number;
  total_price: string;
  currency: string;
  created_at: string;
  note?: string;
  customer?: {
    id: string;
    email?: string;
  };
  line_items?: Array<{
    id: string;
    product_id: string;
    title: string;
  }>;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
  }>;
}

/**
 * Verify Shopify HMAC-SHA256 signature with timing-safe comparison.
 * Returns true if signature is valid, false otherwise.
 * Fails closed (returns false) if the shared secret is not configured.
 */
function verifyShopifyWebhook(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret) {
    logger.error('[verifyShopifyWebhook] Webhook secret not configured — rejecting');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const expected = hmac.digest('base64');
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);

    // Timing-safe compare prevents brute-force attacks on the signature
    return signatureBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(signatureBuf, expectedBuf);
  } catch (err) {
    logger.error('[verifyShopifyWebhook] HMAC verification error', { error: err });
    return false;
  }
}

/**
 * Extract artist ID from Shopify order.
 * Pattern: Look for metafield "indii.artist_id" containing the artist/seller ID.
 * This assumes the order came through an indii-connected store.
 */
function extractArtistId(order: ShopifyOrder): string | null {
  if (!order.metafields) return null;

  const metafield = order.metafields.find(
    (mf) => mf.namespace === 'indii' && mf.key === 'artist_id'
  );
  return metafield?.value || null;
}

/**
 * Parse price string to integer cents.
 * Shopify stores prices as strings (e.g., "25.99" → 2599).
 * Returns null if parsing fails.
 */
function parsePriceToCents(price: string): number | null {
  try {
    const num = parseFloat(price);
    if (isNaN(num) || num < 0) return null;
    return Math.round(num * 100);
  } catch {
    return null;
  }
}

/**
 * Emit a sale conversion event for a Shopify order.
 * Requires a valid artist_id metafield on the order.
 * Exported for testing.
 */
export async function emitSaleConversion(order: ShopifyOrder): Promise<void> {
  const artistId = extractArtistId(order);
  if (!artistId) {
    logger.info('[emitSaleConversion] Order missing indii.artist_id metafield', {
      orderId: order.id,
    });
    return;
  }

  const revenueMinor = parsePriceToCents(order.total_price);
  if (revenueMinor === null || revenueMinor <= 0) {
    logger.warn('[emitSaleConversion] Invalid order price', {
      orderId: order.id,
      totalPrice: order.total_price,
    });
    return;
  }

  const eventId = buildConversionEventId({
    platform: 'shopify',
    eventType: 'sale',
    sourceId: order.id,
  });

  const conversionEvent = {
    schemaVersion: 'conversion-event.v1' as const,
    eventId,
    artistId,
    platform: 'shopify' as const,
    eventType: 'sale' as const,
    occurredAt: order.created_at, // ISO 8601 from Shopify
    revenueMinor,
    costMinor: 0,
    currency: order.currency || 'USD',
    campaignId: '',
    adCreativeId: '',
    smartLinkSlug: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    metadata: {
      shopifyOrderId: order.id,
      orderNumber: String(order.order_number),
    },
  };

  await enqueueConversionEvent(conversionEvent);
  logger.info('[emitSaleConversion] Queued Shopify sale conversion', {
    artistId: artistId.substring(0, 8), // Mask for logs
    orderId: order.id,
    revenueMinor,
  });
}

/**
 * Handle orders/create webhook event.
 */
async function handleOrderCreated(order: ShopifyOrder): Promise<void> {
  try {
    await emitSaleConversion(order);
  } catch (err) {
    logger.error('[handleOrderCreated] Failed to emit conversion', {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err; // Fail so Shopify retries
  }
}

/**
 * Main Shopify webhook handler.
 * Verifies HMAC signature, routes event type, emits conversions.
 */
export const shopifyWebhook = onRequest(
  {
    region: REGION,
    secrets: [shopifyWebhookSecret],
    timeoutSeconds: WEBHOOK_TIMEOUT,
    memory: '512MiB',
    concurrency: 10,
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Verify HMAC-SHA256 signature (fail closed on missing/invalid signature)
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || (() => {
      try {
        return shopifyWebhookSecret.value();
      } catch {
        return '';
      }
    })();

    const signature = req.headers['x-shopify-hmac-sha256'] as string | undefined;
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!signature || !verifyShopifyWebhook(payload, signature, secret)) {
      logger.warn('[shopifyWebhook] Rejected request: invalid or missing HMAC signature');
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const order = typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body as ShopifyOrder;

      if (!order.id || !order.total_price) {
        logger.warn('[shopifyWebhook] Invalid order payload', { order });
        res.status(400).send('Invalid order payload');
        return;
      }

      // Idempotency guard: atomic check-and-set via transaction
      const db = getFirestore();
      const deliveryRef = db.collection('shopify_webhook_deliveries').doc(order.id);

      const alreadyProcessed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(deliveryRef);
        if (snap.exists) {
          const status = snap.get('status');
          const receivedAt = snap.get('receivedAt');
          const receivedMs = typeof receivedAt?.toMillis === 'function'
            ? receivedAt.toMillis()
            : 0;
          const staleProcessing =
            status === 'processing' && Date.now() - receivedMs > 5 * 60 * 1000;
          if (status !== 'failed' && !staleProcessing) {
            return true; // Already processed
          }
          tx.update(deliveryRef, {
            status: 'processing',
            retriedAt: new Date(),
            retryCount: (snap.get('retryCount') || 0) + 1,
          });
          return false;
        }
        // Atomically mark as in-flight
        tx.set(deliveryRef, {
          orderId: order.id,
          receivedAt: new Date(),
          status: 'processing',
          retryCount: 0,
        });
        return false;
      });

      if (alreadyProcessed) {
        logger.info('[shopifyWebhook] Duplicate delivery skipped', { orderId: order.id });
        res.json({ received: true, duplicate: true });
        return;
      }

      // Process the order
      await handleOrderCreated(order);

      // Mark as processed (best-effort)
      deliveryRef
        .update({
          status: 'processed',
          processedAt: new Date(),
        })
        .catch((err) => {
          logger.warn('[shopifyWebhook] Best-effort status update failed', { error: err });
        });

      res.json({ received: true });
    } catch (err) {
      logger.error('[shopifyWebhook] Handler error', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Mark as failed so next retry is not skipped
      const db = getFirestore();
      const orderId = typeof req.body === 'string'
        ? JSON.parse(req.body).id
        : req.body?.id;
      if (orderId) {
        db.collection('shopify_webhook_deliveries')
          .doc(orderId)
          .update({ status: 'failed', error: String(err) })
          .catch((e) => {
            logger.warn('[shopifyWebhook] Failed to mark delivery as failed', { error: e });
          });
      }
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);
