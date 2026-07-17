import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateAppCheckV2 } from '../../middleware/appCheck';

interface SetRecoupmentInput {
    trackId: string;
    amount: number;
    requestId: string;
    reason: string;
}

interface SetRecoupmentResponse {
    success: true;
    trackId: string;
    releaseId: string;
    balanceMicros: number;
    alreadyApplied: boolean;
}

function stableId(...parts: string[]): string {
    return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function requiredId(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 200 || value.includes('/')) {
        throw new HttpsError('invalid-argument', `${field} is invalid.`);
    }
    return value.trim();
}

function requiredReason(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 1_000) {
        throw new HttpsError('invalid-argument', 'reason is required.');
    }
    return value.trim();
}

export async function processSetRecoupmentBalance(
    userId: string,
    rawInput: SetRecoupmentInput,
    firestore: FirebaseFirestore.Firestore = admin.firestore()
): Promise<SetRecoupmentResponse> {
    const trackId = requiredId(rawInput?.trackId, 'trackId');
    const requestId = requiredId(rawInput?.requestId, 'requestId');
    const reason = requiredReason(rawInput?.reason);
    if (typeof rawInput?.amount !== 'number' || !Number.isFinite(rawInput.amount) || rawInput.amount < 0 || rawInput.amount > 1_000_000_000) {
        throw new HttpsError('invalid-argument', 'amount must be between 0 and 1,000,000,000.');
    }
    const balanceMicros = Math.round(rawInput.amount * 1_000_000);
    if (!Number.isSafeInteger(balanceMicros)) {
        throw new HttpsError('invalid-argument', 'amount cannot be represented safely in ledger micros.');
    }

    const adjustmentId = `recoup_adjust_${stableId(userId, requestId).slice(0, 48)}`;
    const adjustmentRef = firestore.collection('recoupment_adjustments').doc(adjustmentId);
    const trackRef = firestore.collection('users').doc(userId).collection('tracks').doc(trackId);

    return firestore.runTransaction(async transaction => {
        const existingAdjustment = await transaction.get(adjustmentRef);
        if (existingAdjustment.exists) {
            const existing = existingAdjustment.data()!;
            return {
                success: true,
                trackId: String(existing.trackId),
                releaseId: String(existing.releaseId),
                balanceMicros: Number(existing.balanceMicros),
                alreadyApplied: true,
            };
        }

        const trackSnapshot = await transaction.get(trackRef);
        if (!trackSnapshot.exists) {
            throw new HttpsError('not-found', 'The track was not found in the authenticated owner catalog.');
        }
        const track = trackSnapshot.data()!;
        const releaseId = requiredId(track.upc ?? trackId, 'releaseId');
        const balanceId = `recoup_${stableId(userId, releaseId).slice(0, 48)}`;
        const balanceRef = firestore.collection('recoupment_balances').doc(balanceId);
        const currentBalanceSnapshot = await transaction.get(balanceRef);
        const previousBalanceMicros = currentBalanceSnapshot.exists && Number.isSafeInteger(currentBalanceSnapshot.data()?.balanceMicros)
            ? Number(currentBalanceSnapshot.data()!.balanceMicros)
            : 0;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        transaction.set(balanceRef, {
            userId,
            releaseId,
            trackId,
            balance: balanceMicros / 1_000_000,
            balanceMicros,
            totalExpense: balanceMicros / 1_000_000,
            totalExpenseMicros: balanceMicros,
            source: 'owner_confirmed_manual_configuration',
            updatedAt: timestamp,
        }, { merge: true });
        transaction.set(adjustmentRef, {
            id: adjustmentId,
            userId,
            trackId,
            releaseId,
            requestId,
            reason,
            previousBalanceMicros,
            balanceMicros,
            deltaMicros: balanceMicros - previousBalanceMicros,
            source: 'owner_confirmed_manual_configuration',
            createdAt: timestamp,
        });

        return {
            success: true,
            trackId,
            releaseId,
            balanceMicros,
            alreadyApplied: false,
        };
    });
}

export const setRecoupmentBalance = onCall(
    { enforceAppCheck: false, timeoutSeconds: 30, memory: '256MiB' },
    async request => {
        validateAppCheckV2(request);
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to configure recoupment.');
        return processSetRecoupmentBalance(request.auth.uid, request.data as SetRecoupmentInput);
    }
);
