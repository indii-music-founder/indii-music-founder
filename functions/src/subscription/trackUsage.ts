/**
 * Firebase Cloud Function: Track Usage
 *
 * Records usage for quota tracking and billing.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { UsageRecord } from '../../../src/services/subscription/types';

export const trackUsage = onCall(async (request) => {
  const { userId, type, amount, project, metadata } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  try {
    const db = getFirestore();

    // Get current subscription
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (!subscriptionDoc.exists()) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionDoc.data();

    // Create usage record
    const usageRecord: UsageRecord = {
      id: crypto.randomUUID(),
      userId,
      subscriptionId: subscription.id,
      project,
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
    throw new Error('Failed to track usage');
  }
});
