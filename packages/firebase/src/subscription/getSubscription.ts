import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { arcjetKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { getOrCreateSubscription } from './subscriptionDefaults';

export const getSubscription = onCall({
  cors: true,
  enforceAppCheck: false,
  secrets: [arcjetKey],
}, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
  }
  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId: request.auth.uid,
      policy: 'verified-free',
      operationId: `get-subscription:${request.auth.uid}`,
    });
    if (!protection.allowed) {
      throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
    }
  }

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
