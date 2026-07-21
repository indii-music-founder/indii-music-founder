import * as admin from 'firebase-admin';

import { failedOperationResult, operationResult, requireString, toolResponse } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';
import { stripe } from '../../stripe/config.js';

const TOOL_NAME = 'stage_stripe_payouts';
const RESOURCE_TYPE = 'payout_job';
const MAX_EARNINGS_DOC_IDS = 100;
const PAYOUT_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const NO_MONEY_MOVED_WARNING =
    'Figures were staged and Stripe Connect accounts were verified as payout-capable. NO Stripe transfer, payout, or money movement was created or scheduled — a separate, explicitly human-approved action is required before any funds move.';

interface PayoutRecipient {
    uid: string;
    percentage: number;
    stripeAccountId?: string;
}

interface ResolvedRecipient extends PayoutRecipient {
    amountMicros: number;
    accountStatus: 'verified' | 'blocked' | 'missing';
    blockReason?: string;
}

/**
 * Reads split recipients for an artist from users/{artistId}/splits. If no
 * split documents exist, the artist is the sole 100% recipient (their own
 * users/{artistId}.stripeAccountId is used as the payout target).
 */
async function readSplitRecipients(
    firestore: FirebaseFirestore.Firestore,
    artistId: string,
): Promise<PayoutRecipient[]> {
    const splitsSnap = await firestore.collection('users').doc(artistId).collection('splits').get();
    if (splitsSnap.empty) {
        const userSnap = await firestore.collection('users').doc(artistId).get();
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const stripeAccountId = typeof userData.stripeAccountId === 'string' && userData.stripeAccountId.trim()
            ? userData.stripeAccountId.trim()
            : undefined;
        return [{ uid: artistId, percentage: 100, stripeAccountId }];
    }
    return splitsSnap.docs.map((doc) => {
        const data = doc.data() || {};
        const percentage = typeof data.percentage === 'number' && Number.isFinite(data.percentage) ? data.percentage : 0;
        const stripeAccountId = typeof data.stripeAccountId === 'string' && data.stripeAccountId.trim()
            ? data.stripeAccountId.trim()
            : undefined;
        return { uid: doc.id, percentage, stripeAccountId };
    });
}

/** Confirms a Stripe Connect account is actually payout-capable. Never assumes — always calls Stripe. */
async function verifyStripeAccount(accountId: string): Promise<{ verified: boolean; reason?: string }> {
    try {
        const account = await stripe.accounts.retrieve(accountId);
        if (!account.payouts_enabled) return { verified: false, reason: 'Stripe account is not payouts_enabled.' };
        if (!account.charges_enabled) return { verified: false, reason: 'Stripe account is not charges_enabled.' };
        const transfersCapability = account.capabilities?.transfers;
        if (transfersCapability !== 'active') {
            return { verified: false, reason: `Stripe account transfers capability is "${transfersCapability ?? 'unset'}", not active.` };
        }
        return { verified: true };
    } catch (error) {
        return { verified: false, reason: error instanceof Error ? error.message : 'Stripe account lookup failed.' };
    }
}

/** Resolves and verifies every split recipient's Stripe account, distributing stagedNetMicros by percentage. */
async function resolveRecipients(recipients: PayoutRecipient[], stagedNetMicros: number): Promise<ResolvedRecipient[]> {
    const resolved = await Promise.all(recipients.map(async (recipient): Promise<ResolvedRecipient> => {
        const amountMicros = Math.round(stagedNetMicros * (recipient.percentage / 100));
        if (!recipient.stripeAccountId) {
            return { ...recipient, amountMicros, accountStatus: 'missing', blockReason: `No stripeAccountId on file for ${recipient.uid}.` };
        }
        const verification = await verifyStripeAccount(recipient.stripeAccountId);
        if (!verification.verified) {
            return { ...recipient, amountMicros, accountStatus: 'blocked', blockReason: verification.reason };
        }
        return { ...recipient, amountMicros, accountStatus: 'verified' };
    }));
    return resolved;
}

/** Micros-first ledger read, mirroring calculateRecoupment conventions. */
function ledgerMicros(microsValue: unknown, decimalValue?: unknown): number {
    if (Number.isSafeInteger(microsValue)) return Number(microsValue);
    if (typeof decimalValue === 'number' && Number.isFinite(decimalValue)) return Math.round(decimalValue * 1_000_000);
    return 0;
}

interface EarningsPeriod {
    startDate?: string;
    endDate?: string;
}

function periodOverlapsMonth(period: unknown, payoutPeriod: string): boolean | null {
    if (!period || typeof period !== 'object') return null;
    const { startDate, endDate } = period as EarningsPeriod;
    if (typeof startDate !== 'string' || typeof endDate !== 'string') return null;
    // ISO date strings (YYYY-MM-DD) compare correctly lexicographically.
    const monthStart = `${payoutPeriod}-01`;
    const monthEnd = `${payoutPeriod}-31`;
    return startDate <= monthEnd && endDate >= monthStart;
}

export const stageStripePayouts: IndiiMcpTool = {
    name: TOOL_NAME,
    description:
        'Stages a royalty payout figure from real Firestore earnings and recoupment ledgers for later human approval. Never moves money — creates no Stripe transfer or payout.',
    inputSchema: {
        type: 'object',
        properties: {
            artistId: { type: 'string', description: 'Must equal the authenticated caller uid (admins may act on behalf of an artist).' },
            payoutPeriod: { type: 'string', description: 'Payout period in YYYY-MM format.' },
        },
        required: ['artistId', 'payoutPeriod'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;

        let artistId = 'unknown';
        let payoutPeriod = 'unknown';
        try {
            artistId = requireString(args, 'artistId', 200);
            payoutPeriod = requireString(args, 'payoutPeriod', 16);
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: RESOURCE_TYPE,
                resourceId: 'none',
                code: 'INVALID_ARGUMENT',
                message: error instanceof Error ? error.message : 'Invalid arguments.',
                retryable: false,
            }));
        }

        // The artistId argument IS the payout target. It must be the
        // authenticated caller (or the caller must be an admin). Never derive
        // the authorization target from other model-supplied args.
        if (artistId !== actorUid && context.user.admin !== true) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: RESOURCE_TYPE,
                resourceId: 'none',
                code: 'FORBIDDEN',
                message: `Forbidden: caller ${actorUid} cannot stage payouts for artist ${artistId}.`,
                retryable: false,
            }));
        }

        if (!PAYOUT_PERIOD_PATTERN.test(payoutPeriod)) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: RESOURCE_TYPE,
                resourceId: 'none',
                code: 'INVALID_ARGUMENT',
                message: `payoutPeriod must be in YYYY-MM format; received "${payoutPeriod}".`,
                retryable: false,
            }));
        }

        try {
            const firestore = admin.firestore();
            const [earningsSnap, balancesSnap] = await Promise.all([
                firestore.collection('earnings').where('userId', '==', artistId).get(),
                firestore.collection('recoupment_balances').where('userId', '==', artistId).get(),
            ]);

            const warnings: string[] = [NO_MONEY_MOVED_WARNING];

            // Filter earnings to the requested payout period. Earnings docs
            // carry `period: { startDate, endDate }` (see ingestEarningsReport).
            // If NO doc carries period metadata, aggregate everything honestly.
            const anyPeriodMetadata = earningsSnap.docs.some(doc => periodOverlapsMonth((doc.data() || {}).period, payoutPeriod) !== null);
            let excludedNoPeriodCount = 0;
            const matchedDocs = earningsSnap.docs.filter(doc => {
                const overlap = periodOverlapsMonth((doc.data() || {}).period, payoutPeriod);
                if (overlap === null) {
                    if (anyPeriodMetadata) excludedNoPeriodCount += 1;
                    return !anyPeriodMetadata;
                }
                return overlap;
            });
            if (!anyPeriodMetadata && earningsSnap.docs.length > 0) {
                warnings.push(`No earnings documents carry period metadata; ALL ${earningsSnap.docs.length} earnings documents for artist ${artistId} were aggregated regardless of payoutPeriod ${payoutPeriod}.`);
            }
            if (excludedNoPeriodCount > 0) {
                warnings.push(`${excludedNoPeriodCount} earnings document(s) lacked period metadata and were EXCLUDED from this staging; reconcile them manually.`);
            }

            let earningsNetMicros = 0;
            const earningsDocIds: string[] = [];
            matchedDocs.forEach(doc => {
                const data = doc.data() || {};
                earningsNetMicros += ledgerMicros(data.netRevenueMicros, data.netRevenue);
                earningsDocIds.push(doc.id);
            });

            let outstandingRecoupmentMicros = 0;
            balancesSnap.docs.forEach(doc => {
                const data = doc.data() || {};
                outstandingRecoupmentMicros += Math.max(0, ledgerMicros(data.balanceMicros, data.balance));
            });

            const stagedNetMicros = Math.max(0, earningsNetMicros - outstandingRecoupmentMicros);

            if (matchedDocs.length === 0 || stagedNetMicros <= 0) {
                warnings.push(
                    matchedDocs.length === 0
                        ? `No earnings documents matched artist ${artistId} for period ${payoutPeriod}; there is nothing to stage and no payout job was written.`
                        : `Net earnings (${earningsNetMicros} micros) do not exceed outstanding recoupment (${outstandingRecoupmentMicros} micros); nothing to stage and no payout job was written.`,
                );
                return toolResponse(operationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    status: 'succeeded',
                    resourceType: RESOURCE_TYPE,
                    resourceId: 'none',
                    warnings,
                    data: {
                        artistId,
                        payoutPeriod,
                        stagedNetMicros: 0,
                        earningsCount: matchedDocs.length,
                        earningsNetMicros,
                        outstandingRecoupmentMicros,
                    },
                }));
            }

            let persistedEarningsDocIds = earningsDocIds;
            if (earningsDocIds.length > MAX_EARNINGS_DOC_IDS) {
                persistedEarningsDocIds = earningsDocIds.slice(0, MAX_EARNINGS_DOC_IDS);
                warnings.push(`earningsDocIds truncated to ${MAX_EARNINGS_DOC_IDS} of ${earningsDocIds.length} contributing earnings documents on the payout job record.`);
            }

            // Resolve split recipients (or the artist alone, 100%) and verify
            // each Stripe Connect account is actually payout-capable. A missing
            // or blocked account is a BLOCKING warning, never a silent skip.
            const recipients = await readSplitRecipients(firestore, artistId);
            const resolvedRecipients = await resolveRecipients(recipients, stagedNetMicros);
            const blockedRecipients = resolvedRecipients.filter((r) => r.accountStatus !== 'verified');
            blockedRecipients.forEach((r) => {
                warnings.push(`BLOCKING: recipient ${r.uid} (${r.percentage}%) cannot receive funds — ${r.blockReason}`);
            });
            const allBlocked = blockedRecipients.length === resolvedRecipients.length;

            // Whitelisted fields only — never persist raw args.
            const docRef = await firestore.collection('payoutJobs').add({
                artistId,
                payoutPeriod,
                stagedNetMicros,
                earningsDocIds: persistedEarningsDocIds,
                outstandingRecoupmentMicros,
                status: 'staged_pending_approval',
                initiatorUid: actorUid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const transferGroupId = `payout_${artistId}_${payoutPeriod}_${docRef.id}`;
            const batchRecipients = resolvedRecipients.map((r) => ({
                uid: r.uid,
                percentage: r.percentage,
                amountMicros: r.amountMicros,
                stripeAccountId: r.stripeAccountId ?? null,
                accountStatus: r.accountStatus,
                ...(r.blockReason ? { blockReason: r.blockReason } : {}),
            }));
            const batchRef = await firestore.collection('payoutBatches').add({
                artistId,
                payoutPeriod,
                payoutJobId: docRef.id,
                transferGroupId,
                stagedNetMicros,
                recipients: batchRecipients,
                status: allBlocked ? 'blocked_no_verified_recipients' : 'staged_pending_approval',
                initiatorUid: actorUid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (allBlocked) {
                warnings.push('No recipient has a verified, payout-capable Stripe Connect account. This batch cannot proceed to approval until at least one account is fixed.');
            }
            warnings.push('No approval endpoint exists yet to execute this staged batch — createTransfer is intentionally not wired to this tool ([[Explicit permission required]]: money movement stays a separate human-approved action).');

            return toolResponse(operationResult({
                tool: TOOL_NAME,
                actorUid,
                status: 'succeeded',
                resourceType: RESOURCE_TYPE,
                resourceId: docRef.id,
                approvalRequired: true,
                warnings,
                evidence: [
                    { type: 'firestore_document', reference: `payoutJobs/${docRef.id}` } as never,
                    { type: 'firestore_document', reference: `payoutBatches/${batchRef.id}` } as never,
                ],
                data: {
                    artistId,
                    payoutPeriod,
                    payoutJobId: docRef.id,
                    payoutBatchId: batchRef.id,
                    transferGroupId,
                    stagedNetMicros,
                    earningsCount: matchedDocs.length,
                    earningsNetMicros,
                    outstandingRecoupmentMicros,
                    recipients: batchRecipients,
                    status: allBlocked ? 'blocked_no_verified_recipients' : 'staged_pending_approval',
                },
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: RESOURCE_TYPE,
                resourceId: 'none',
                code: 'LEDGER_READ_FAILED',
                message: error instanceof Error ? error.message : 'Payout staging failed reading Firestore ledgers.',
                retryable: true,
                warnings: [NO_MONEY_MOVED_WARNING],
            }));
        }
    },
};
