/**
 * Firebase Cloud Function: Track Usage
 *
 * Records usage for quota tracking and billing.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { UsageRecord } from '../shared/subscription/types';
import * as crypto from 'crypto';

export const trackUsage = onCall({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true' }, async (request) => {
  const { userId, type, amount, project, metadata } = request.data;

  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Usage tracking requires an authenticated user.');
  }

  // Validate userId matches auth
  if (userId && userId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Unauthorized: userId mismatch');
  }

  const effectiveUserId = userId || request.auth.uid;

  try {
    const db = getFirestore();

    // Get current subscription (optional - don't fail if missing)
    const subscriptionDoc = await db.collection('subscriptions').doc(effectiveUserId).get();

    if (!subscriptionDoc.exists) {
      // No subscription = free tier user. Still track but don't require subscription doc.
      console.log('[trackUsage] No subscription found, tracking as free tier user');

      const usageRecord: UsageRecord = {
        id: crypto.randomUUID(),
        userId: effectiveUserId,
        subscriptionId: 'free-tier',
        project: project || 'default',
        type,
        amount,
        timestamp: Date.now(),
        metadata
      };

      await db.collection('usage').add(usageRecord);
      return { success: true, tier: 'free' };
    }

    const subscription = subscriptionDoc.data();

    if (!subscription) {
      console.warn('[trackUsage] Subscription doc exists but no data');
      throw new HttpsError('failed-precondition', 'Subscription record is empty. Usage was not tracked.');
    }

    // Create usage record
    const usageRecord: UsageRecord = {
      id: crypto.randomUUID(),
      userId: effectiveUserId,
      subscriptionId: subscription.id || 'unknown',
      project: project || 'default',
      type,
      amount,
      timestamp: Date.now(),
      metadata
    };

    // Add to usage collection
    await db.collection('usage').add(usageRecord);

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[trackUsage] Error:', error);
    throw new HttpsError('internal', 'Internal error during usage tracking', String(error));
  }
});
