/**
 * Firebase Cloud Function: Get User Subscription
 *
 * Retrieves the current subscription for a user.
 * If no subscription exists, creates a free tier subscription.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { Subscription, SubscriptionTier } from '../../../src/services/subscription/types';

export const getSubscription = onCall(async (request) => {
  const { userId } = request.data;

  if (!userId) {
    throw new Error('User ID is required');
  }

  if (userId !== request.auth?.uid) {
    throw new Error('Unauthorized: User ID does not match authenticated user');
  }

  try {
    const db = getFirestore();
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();

    if (!subscriptionDoc.exists) {
      // Create free tier subscription for new users
      const now = Date.now();
      const freeSubscription: Subscription = {
        id: crypto.randomUUID(),
        userId,
        tier: SubscriptionTier.FREE,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now
      };

      await db.collection('subscriptions').doc(userId).set(freeSubscription);
      return freeSubscription;
    }

    return subscriptionDoc.data() as Subscription;
  } catch (error) {
    console.error('[getSubscription] Error:', error);
    throw new Error('Failed to retrieve subscription');
  }
});
