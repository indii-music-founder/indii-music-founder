import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateAppCheckV2 } from '../../middleware/appCheck';

const SHARE_UNITS_PER_PERCENT = 10_000;
const TOTAL_SHARE_UNITS = 100 * SHARE_UNITS_PER_PERCENT;
const MAX_EARNINGS_PER_RECEIPT = 5_000;
const ALLOCATION_CONCURRENCY = 10;

export interface RecordingRoyaltySplit {
    legalName: string;
    email: string;
    role: string;
    percentage: number;
}

export interface ProvisionalRoyaltyAllocationInput {
    grossRevenueMicros: number;
    recoupmentBalanceMicros: number;
    recordingSplits: unknown;
    legacySplits: unknown;
}

export interface ProvisionalRoyaltyAllocation {
    recipientName: string;
    recipientEmail: string;
    role: string;
    percentage: number;
    amountMicros: number;
}

export interface ProvisionalRoyaltyAllocationResult {
    status: 'held_for_reconciliation' | 'blocked_invalid_splits' | 'blocked_negative_adjustment';
    blockReason?: string;
    recoupmentAppliedMicros: number;
    remainingRecoupmentMicros: number;
    distributableMicros: number;
    allocations: ProvisionalRoyaltyAllocation[];
}

function stableId(...parts: string[]): string {
    return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function parseSplits(value: unknown): RecordingRoyaltySplit[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
    const splits: RecordingRoyaltySplit[] = [];
    for (const candidate of value) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
        const data = candidate as Record<string, unknown>;
        if (
            typeof data.legalName !== 'string' || !data.legalName.trim() ||
            typeof data.email !== 'string' || !data.email.trim() ||
            typeof data.role !== 'string' || !data.role.trim() ||
            typeof data.percentage !== 'number' || !Number.isFinite(data.percentage) ||
            data.percentage <= 0 || data.percentage > 100
        ) return null;
        splits.push({
            legalName: data.legalName.trim().slice(0, 240),
            email: data.email.trim().toLowerCase().slice(0, 320),
            role: data.role.trim().slice(0, 80),
            percentage: data.percentage,
        });
    }
    return splits;
}

/**
 * Calculates a recording/master-revenue obligation without making it payable.
 * Imported DSR data remains user-uploaded and unverified, so every result is
 * held for reconciliation until a separate, audited approval/payment flow.
 */
export function calculateProvisionalAllocation(
    input: ProvisionalRoyaltyAllocationInput
): ProvisionalRoyaltyAllocationResult {
    if (!Number.isSafeInteger(input.grossRevenueMicros)) {
        throw new HttpsError('invalid-argument', 'Gross revenue must be represented as integer micros.');
    }
    if (!Number.isSafeInteger(input.recoupmentBalanceMicros) || input.recoupmentBalanceMicros < 0) {
        throw new HttpsError('invalid-argument', 'Recoupment balance must be a non-negative integer number of micros.');
    }
    if (input.grossRevenueMicros < 0) {
        return {
            status: 'blocked_negative_adjustment',
            blockReason: 'Negative statement adjustments require manual reconciliation against prior obligations.',
            recoupmentAppliedMicros: 0,
            remainingRecoupmentMicros: input.recoupmentBalanceMicros,
            distributableMicros: 0,
            allocations: [],
        };
    }

    // Distributor DSR rows are recording/master revenue. Explicit recording
    // ownership is authoritative; legacy splits are used only for migration.
    const explicitRecordingSplits = parseSplits(input.recordingSplits);
    const splits = explicitRecordingSplits ?? parseSplits(input.legacySplits);
    if (!splits) {
        return {
            status: 'blocked_invalid_splits',
            blockReason: 'Recording-owner splits are missing or incomplete.',
            recoupmentAppliedMicros: 0,
            remainingRecoupmentMicros: input.recoupmentBalanceMicros,
            distributableMicros: 0,
            allocations: [],
        };
    }

    const shareUnits = splits.map(split => Math.round(split.percentage * SHARE_UNITS_PER_PERCENT));
    const totalShareUnits = shareUnits.reduce((total, units) => total + units, 0);
    if (totalShareUnits !== TOTAL_SHARE_UNITS) {
        return {
            status: 'blocked_invalid_splits',
            blockReason: `Recording-owner splits must total exactly 100% (received ${totalShareUnits / SHARE_UNITS_PER_PERCENT}%).`,
            recoupmentAppliedMicros: 0,
            remainingRecoupmentMicros: input.recoupmentBalanceMicros,
            distributableMicros: 0,
            allocations: [],
        };
    }

    const recoupmentAppliedMicros = Math.min(input.grossRevenueMicros, input.recoupmentBalanceMicros);
    const remainingRecoupmentMicros = input.recoupmentBalanceMicros - recoupmentAppliedMicros;
    const distributableMicros = input.grossRevenueMicros - recoupmentAppliedMicros;
    const distributable = BigInt(distributableMicros);
    const denominator = BigInt(TOTAL_SHARE_UNITS);
    const working = splits.map((split, index) => {
        const numerator = distributable * BigInt(shareUnits[index]!);
        return {
            index,
            split,
            amountMicros: Number(numerator / denominator),
            remainder: numerator % denominator,
        };
    });

    let unassignedMicros = distributableMicros - working.reduce((total, item) => total + item.amountMicros, 0);
    const remainderOrder = [...working].sort((left, right) => {
        if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
        const leftKey = `${left.split.email}\0${left.split.role}\0${left.index}`;
        const rightKey = `${right.split.email}\0${right.split.role}\0${right.index}`;
        return leftKey.localeCompare(rightKey);
    });
    for (let index = 0; index < unassignedMicros; index++) {
        remainderOrder[index % remainderOrder.length]!.amountMicros += 1;
    }
    unassignedMicros = 0;

    return {
        status: 'held_for_reconciliation',
        recoupmentAppliedMicros,
        remainingRecoupmentMicros,
        distributableMicros,
        allocations: working.map(({ split, amountMicros }) => ({
            recipientName: split.legalName,
            recipientEmail: split.email,
            role: split.role,
            percentage: split.percentage,
            amountMicros,
        })),
    };
}

function requiredId(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 200 || value.includes('/')) {
        throw new HttpsError('invalid-argument', `${label} is invalid.`);
    }
    return value.trim();
}

export interface RoyaltyAllocationResponse {
    success: true;
    batchId: string;
    processedEarnings: number;
    alreadyProcessedEarnings: number;
    heldPayouts: number;
    blockedEarnings: number;
}

export async function processRoyaltyAllocations(
    userId: string,
    rawBatchId: unknown,
    firestore: FirebaseFirestore.Firestore = admin.firestore()
): Promise<RoyaltyAllocationResponse> {
    const batchId = requiredId(rawBatchId, 'batchId');
    const receiptRef = firestore.collection('dsr_processed_reports').doc(batchId);
    const receiptSnapshot = await receiptRef.get();
    if (!receiptSnapshot.exists || receiptSnapshot.data()?.userId !== userId) {
        throw new HttpsError('not-found', 'The earnings receipt was not found for this owner.');
    }
    const receipt = receiptSnapshot.data()!;
    const earningsIds = Array.isArray(receipt.earningsIds)
        ? receipt.earningsIds.filter((value): value is string => typeof value === 'string' && value.length > 0 && !value.includes('/'))
        : [];
    if (earningsIds.length === 0 || earningsIds.length > MAX_EARNINGS_PER_RECEIPT) {
        throw new HttpsError('failed-precondition', 'The earnings receipt has no allocatable earnings records.');
    }

    let processedEarnings = 0;
    let alreadyProcessedEarnings = 0;
    let heldPayouts = 0;
    let blockedEarnings = 0;

    const processEarnings = async (earningsId: string) => firestore.runTransaction(async transaction => {
            const claimId = `allocation_${stableId(userId, batchId, earningsId).slice(0, 48)}`;
            const claimRef = firestore.collection('royalty_report_claims').doc(claimId);
            const claimSnapshot = await transaction.get(claimRef);
            if (claimSnapshot.exists) return { alreadyProcessed: true, heldPayouts: 0, blocked: false };

            const earningsRef = firestore.collection('earnings').doc(earningsId);
            const earningsSnapshot = await transaction.get(earningsRef);
            if (!earningsSnapshot.exists) {
                throw new HttpsError('failed-precondition', `Earnings record ${earningsId} is missing.`);
            }
            const earnings = earningsSnapshot.data()!;
            if (earnings.userId !== userId || earnings.sourceReceiptId !== batchId) {
                throw new HttpsError('permission-denied', 'An earnings record does not belong to this receipt and owner.');
            }

            const trackId = requiredId(earnings.trackId, 'trackId');
            const trackRef = firestore.collection('users').doc(userId).collection('tracks').doc(trackId);
            const trackSnapshot = await transaction.get(trackRef);
            if (!trackSnapshot.exists) {
                throw new HttpsError('failed-precondition', `Track metadata ${trackId} is missing.`);
            }
            const track = trackSnapshot.data()!;
            const releaseId = requiredId(earnings.releaseId ?? trackId, 'releaseId');
            const recoupmentId = `recoup_${stableId(userId, releaseId).slice(0, 48)}`;
            const recoupmentRef = firestore.collection('recoupment_balances').doc(recoupmentId);
            const recoupmentSnapshot = await transaction.get(recoupmentRef);
            const recoupment = recoupmentSnapshot.exists ? recoupmentSnapshot.data()! : {};
            const recoupmentBalanceMicros = Number.isSafeInteger(recoupment.balanceMicros)
                ? Number(recoupment.balanceMicros)
                : 0;
            const grossRevenueMicros = Math.round(Number(earnings.netRevenue) * 1_000_000);
            const allocation = calculateProvisionalAllocation({
                grossRevenueMicros,
                recoupmentBalanceMicros,
                recordingSplits: track.recordingSplits,
                legacySplits: track.splits,
            });
            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            if (allocation.status === 'held_for_reconciliation') {
                allocation.allocations.forEach(item => {
                    const payoutId = `payout_${stableId(userId, earningsId, item.recipientEmail, item.role).slice(0, 48)}`;
                    transaction.set(firestore.collection('payouts').doc(payoutId), {
                        id: payoutId,
                        userId,
                        recipientEmail: item.recipientEmail,
                        recipientName: item.recipientName,
                        role: item.role,
                        splitPercentage: item.percentage,
                        amountMicros: item.amountMicros,
                        amount: item.amountMicros / 1_000_000,
                        currency: earnings.currencyCode,
                        sourceTrackIsrc: earnings.isrc,
                        trackId,
                        releaseId,
                        sourceEarningsId: earningsId,
                        sourceReceiptId: batchId,
                        sourceTrust: earnings.sourceTrust,
                        reconciliationStatus: earnings.reconciliationStatus,
                        status: 'held_for_reconciliation',
                        taxStatus: 'not_calculated',
                        period: `${earnings.period?.startDate ?? ''}/${earnings.period?.endDate ?? ''}`,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                    });
                });
                if (allocation.recoupmentAppliedMicros > 0) {
                    transaction.set(recoupmentRef, {
                        userId,
                        releaseId,
                        balanceMicros: allocation.remainingRecoupmentMicros,
                        lastAppliedEarningsId: earningsId,
                        updatedAt: timestamp,
                    }, { merge: true });
                }
            }

            transaction.set(claimRef, {
                userId,
                reportId: receipt.reportId,
                releaseId,
                sourceReceiptId: batchId,
                sourceEarningsId: earningsId,
                status: allocation.status,
                blockReason: allocation.blockReason ?? null,
                payoutCount: allocation.allocations.length,
                recoupmentAppliedMicros: allocation.recoupmentAppliedMicros,
                distributableMicros: allocation.distributableMicros,
                processedAt: timestamp,
            });
            transaction.set(earningsRef, {
                allocationStatus: allocation.status,
                allocationBlockReason: allocation.blockReason ?? null,
                allocationUpdatedAt: timestamp,
            }, { merge: true });
            return {
                alreadyProcessed: false,
                heldPayouts: allocation.allocations.length,
                blocked: allocation.status !== 'held_for_reconciliation',
            };
        });

    // Independent earnings claims can be processed concurrently. A small pool
    // avoids a 5,000-row report becoming thousands of sequential round trips;
    // Firestore transactions still serialize safely when album tracks share a
    // release-level recoupment balance.
    for (let index = 0; index < earningsIds.length; index += ALLOCATION_CONCURRENCY) {
        const results = await Promise.all(
            earningsIds.slice(index, index + ALLOCATION_CONCURRENCY).map(processEarnings)
        );
        results.forEach(result => {
            if (result.alreadyProcessed) alreadyProcessedEarnings++;
            else {
                processedEarnings++;
                heldPayouts += result.heldPayouts;
                if (result.blocked) blockedEarnings++;
            }
        });
    }

    await receiptRef.set({
        allocationSummary: {
            status: blockedEarnings > 0 ? 'attention_required' : 'held_for_reconciliation',
            processedEarnings,
            alreadyProcessedEarnings,
            heldPayouts,
            blockedEarnings,
        },
        allocationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
        success: true,
        batchId,
        processedEarnings,
        alreadyProcessedEarnings,
        heldPayouts,
        blockedEarnings,
    };
}

export const calculateRoyaltyAllocations = onCall(
    { enforceAppCheck: false, timeoutSeconds: 540, memory: '512MiB' },
    async request => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Sign in to calculate royalty allocations.');
        }
        return processRoyaltyAllocations(request.auth.uid, request.data?.batchId);
    }
);
