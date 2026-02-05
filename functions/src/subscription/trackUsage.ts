/**
 * Firebase Cloud Function: Track Usage
 *
 * Records usage for quota tracking and billing.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { UsageRecord } from '../shared/subscription/types';
import * as crypto from 'crypto';

export const trackUsage = onCall(async (request) => {
  const { userId, type, amount, project, metadata } = request.data;

  // DEMO MODE HANDLING: Allow unauthenticated/demo users
  // If no auth or no userId, skip tracking but return success
  // This prevents 500 errors that abort agent execution loops
  if (!request.auth?.uid) {
    console.log('[trackUsage] Skipping tracking for unauthenticated user (demo mode)');
    return { success: true, skipped: true, reason: 'unauthenticated' };
  }

  // Validate userId matches auth
  if (userId && userId !== request.auth.uid) {
    throw new Error('Unauthorized: userId mismatch');
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
      return { success: true, skipped: true, reason: 'empty_subscription' };
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
    console.error('[trackUsage] Error:', error);
    // Don't throw - return a soft failure to prevent agent abort
    return { success: false, error: String(error), skipped: true };
  }
});
