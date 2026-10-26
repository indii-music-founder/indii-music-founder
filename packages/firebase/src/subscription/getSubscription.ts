import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getOrCreateSubscription } from './subscriptionDefaults';
import { arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export const getSubscription = onCall({
  cors: true,
  secrets: [arcjetKey],
  enforceAppCheck: false,
}, async (request) => {
  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError('invalid-argument', 'User ID is required');
  }

  if (userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized: User ID does not match authenticated user');
  }

  if (request.auth?.token?.email_verified === false || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
  }

  validateAppCheckV2(request);

  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId,
      policy: request.auth?.token?.admin ? 'admin' : 'verified-free',
      operationId: `get-subscription:${randomUUID()}`,
    });
    if (!protection.allowed) {
      throw new HttpsError(
        protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
        protection.message,
      );
    }
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
