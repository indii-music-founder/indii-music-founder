import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getOrCreateSubscription } from './subscriptionDefaults';

export const getSubscription = onCall({ cors: true, enforceAppCheck: false /* true */ }, async (request) => {
  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError('invalid-argument', 'User ID is required');
  }

  if (userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized: User ID does not match authenticated user');
  }

  try {
    const db = getFirestore();
    return await getOrCreateSubscription(db, userId);
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[getSubscription] Error:', error);
    throw new HttpsError('internal', 'Failed to retrieve subscription');
  }
});
