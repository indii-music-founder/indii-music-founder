import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { CreditWalletSchema, STANDARD_CREDIT_PACKS } from '@indii/shared';

export interface UpdateWalletSettingsRequest {
  userId?: string;
  autoTopUp: boolean;
  autoTopUpThreshold?: number;
  autoTopUpPackId?: string;
}

export interface UpdateWalletSettingsResponse {
  success: boolean;
  wallet: {
    userId: string;
    balanceCredits: number;
    autoTopUp: boolean;
    autoTopUpThreshold: number;
    autoTopUpPackId?: string;
    currency: string;
    createdAt: number;
    updatedAt: number;
  };
}

export const updateWalletSettings = onCall({
  timeoutSeconds: 60,
  memory: '512MiB',
  enforceAppCheck: true,
}, async (request): Promise<UpdateWalletSettingsResponse> => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to update wallet settings');
  }

  const data = request.data as UpdateWalletSettingsRequest;
  const targetUserId = data?.userId || callerUid;

  // Caller can only update their own wallet unless they hold admin claims
  if (targetUserId !== callerUid && !request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'Cannot update wallet settings for another user');
  }

  const { autoTopUp, autoTopUpThreshold, autoTopUpPackId } = data || {};

  if (typeof autoTopUp !== 'boolean') {
    throw new HttpsError('invalid-argument', 'autoTopUp must be a boolean');
  }

  if (autoTopUpThreshold !== undefined) {
    if (typeof autoTopUpThreshold !== 'number' || !Number.isInteger(autoTopUpThreshold) || autoTopUpThreshold < 0) {
      throw new HttpsError('invalid-argument', 'autoTopUpThreshold must be a non-negative integer');
    }
  }

  if (autoTopUpPackId !== undefined && autoTopUpPackId !== null && autoTopUpPackId !== '') {
    const validPackIds = STANDARD_CREDIT_PACKS.map(p => p.id);
    if (!validPackIds.includes(autoTopUpPackId)) {
      throw new HttpsError('invalid-argument', `Invalid autoTopUpPackId. Must be one of: ${validPackIds.join(', ')}`);
    }
  }

  const db = getFirestore();
  const walletRef = db.collection('users').doc(targetUserId).collection('wallet').doc('current');

  try {
    const updatedWallet = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(walletRef);
      const now = Date.now();

      const existingData = snap.exists ? snap.data() : null;
      const currentBalance = typeof existingData?.balanceCredits === 'number'
        ? existingData.balanceCredits
        : 0;
      const createdAt = typeof existingData?.createdAt === 'number'
        ? existingData.createdAt
        : now;

      const walletPayload = {
        userId: targetUserId,
        balanceCredits: currentBalance,
        autoTopUp,
        autoTopUpThreshold: autoTopUpThreshold !== undefined ? autoTopUpThreshold : (existingData?.autoTopUpThreshold ?? 100),
        ...(autoTopUpPackId ? { autoTopUpPackId } : {}),
        currency: 'USD' as const,
        createdAt,
        updatedAt: now,
      };

      // Validate schema
      const parseResult = CreditWalletSchema.safeParse(walletPayload);
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', `Wallet validation failed: ${parseResult.error.message}`);
      }

      if (!snap.exists) {
        transaction.set(walletRef, walletPayload);
      } else {
        transaction.update(walletRef, walletPayload);
      }

      return walletPayload;
    });

    return {
      success: true,
      wallet: updatedWallet,
    };
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[updateWalletSettings] Transaction failure:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to update wallet settings');
  }
});
