import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

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
}

export const deductCredits = onCall({
  timeoutSeconds: 60,
  memory: '512MiB',
  enforceAppCheck: true,
}, async (request): Promise<DeductCreditsResponse> => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to deduct credits');
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
      const walletSnap = await transaction.get(walletRef);
      const currentBalance = walletSnap.exists && typeof walletSnap.data()?.balanceCredits === 'number'
        ? walletSnap.data()!.balanceCredits
        : 0;

      if (currentBalance < amount) {
        throw new HttpsError(
          'failed-precondition',
          `Insufficient credit balance. Required: ${amount}, Available: ${currentBalance}`
        );
      }

      const balanceAfter = currentBalance - amount;
      const now = Date.now();

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

      // Synchronize legacy user_credits if document exists
      const legacySnap = await transaction.get(legacyCreditsRef);
      if (legacySnap.exists) {
        const legacyBal = legacySnap.data()?.balance || 0;
        transaction.update(legacyCreditsRef, {
          balance: Math.max(0, legacyBal - amount),
          updatedAt: now,
        });
      }

      return { balanceAfter, txId };
    });

    return {
      success: true,
      balanceAfter: result.balanceAfter,
      transactionId: result.txId,
    };
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[deductCredits] Transaction failure:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Credit deduction failed');
  }
});
