import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export interface DeductCreditsRequest {
  amount: number;
  reason: string;
  referenceId?: string;
  userId?: string;
}

export interface DeductCreditsResponse {
  success: boolean;
  balanceAfter: number;
  transactionId: string;
  autoTopUpTriggered?: boolean;
}

export const deductCredits = onCall({
  secrets: [arcjetKey],
  timeoutSeconds: 60,
  memory: '512MiB',
  enforceAppCheck: false,
}, async (request): Promise<DeductCreditsResponse> => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to deduct credits');
  }

  if (request.auth?.token?.email_verified === false || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
  }

  validateAppCheckV2(request);

  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId: callerUid,
      policy: request.auth?.token?.admin ? 'admin' : 'paid',
      operationId: `deduct-credits:${crypto.randomUUID()}`,
    });
    if (!protection.allowed) {
      throw new HttpsError(
        protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
        protection.message,
      );
    }
  }

  const data = request.data as DeductCreditsRequest;
  const targetUserId = data?.userId || callerUid;

  // Caller can only deduct their own credits unless they hold admin claims
  if (targetUserId !== callerUid && !request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'Cannot deduct credits for another user');
  }

  const { amount, reason, referenceId } = data || {};

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Amount must be a positive integer');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Reason must be a non-empty string');
  }

  const db = getFirestore();
  const walletRef = db.collection('users').doc(targetUserId).collection('wallet').doc('current');
  const txId = `tx_${Date.now()}_${crypto.randomUUID()}`;
  const txRef = db.collection('users').doc(targetUserId).collection('credit_transactions').doc(txId);
  const legacyCreditsRef = db.collection('user_credits').doc(targetUserId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Firestore requires every transaction read before the first write.
      const [walletSnap, legacySnap] = await Promise.all([
        transaction.get(walletRef),
        transaction.get(legacyCreditsRef),
      ]);
      const walletData = walletSnap.exists ? walletSnap.data() : null;
      const currentBalance = typeof walletData?.balanceCredits === 'number'
        ? walletData.balanceCredits
        : 0;

      if (currentBalance < amount) {
        throw new HttpsError(
          'failed-precondition',
          `Insufficient credit balance. Required: ${amount}, Available: ${currentBalance}`
        );
      }

      const balanceAfter = currentBalance - amount;
      const now = Date.now();

      const autoTopUpEnabled = !!walletData?.autoTopUp;
      const threshold = typeof walletData?.autoTopUpThreshold === 'number'
        ? walletData.autoTopUpThreshold
        : 100;
      const shouldTriggerAutoTopUp = autoTopUpEnabled && balanceAfter <= threshold;

      transaction.update(walletRef, {
        balanceCredits: balanceAfter,
        updatedAt: now,
      });

      transaction.set(txRef, {
        id: txId,
        userId: targetUserId,
        type: 'CONSUMPTION',
        amountCredits: amount,
        balanceAfter,
        reason: reason.trim(),
        ...(referenceId ? { referenceId } : {}),
        createdAt: now,
      });

      if (shouldTriggerAutoTopUp) {
        const eventId = `event_${now}_${crypto.randomUUID()}`;
        const eventRef = db.collection('users').doc(targetUserId).collection('wallet_events').doc(eventId);
        transaction.set(eventRef, {
          id: eventId,
          userId: targetUserId,
          type: 'AUTO_TOP_UP_TRIGGERED',
          balanceAfter,
          threshold,
          packId: walletData?.autoTopUpPackId || 'pack_starter_500',
          createdAt: now,
          status: 'PENDING',
        });
      }

      // Synchronize legacy user_credits if document exists
      if (legacySnap.exists) {
        const legacyBal = legacySnap.data()?.balance || 0;
        transaction.update(legacyCreditsRef, {
          balance: Math.max(0, legacyBal - amount),
          updatedAt: now,
        });
      }

      return { balanceAfter, txId, autoTopUpTriggered: shouldTriggerAutoTopUp };
    });

    return {
      success: true,
      balanceAfter: result.balanceAfter,
      transactionId: result.txId,
      autoTopUpTriggered: result.autoTopUpTriggered,
    };
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[deductCredits] Transaction failure:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Credit deduction failed');
  }
});
