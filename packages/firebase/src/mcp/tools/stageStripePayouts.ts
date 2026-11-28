import * as admin from 'firebase-admin';

import { AdminLedgerReceiptSchema, type AdminLedgerReceipt } from '@indii/shared';

import { failedOperationResult, operationResult, requireString, toolResponse } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';
import { stripe } from '../../stripe/config.js';

const TOOL_NAME = 'stage_stripe_payouts';
const RESOURCE_TYPE = 'payout_job';
const MAX_EARNINGS_DOC_IDS = 100;
const PAYOUT_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Owner ledgers hold one receipt per master lock; past this the scan fails closed instead of paging. */
const MAX_LEDGER_RECEIPTS_SCANNED = 2000;
const MAX_HELD_EARNINGS_RECORDED = 100;
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

interface HeldEarnings {
    isrc: string;
    netMicros: number;
    reason: 'multi_party_locked_split' | 'invalid_ledger_receipt';
    ledgerReceiptId: string;
}

interface SplitReceiptClassification {
    payableNetMicros: number;
    held: HeldEarnings[];
    soleLineReceiptIds: string[];
    isrcsWithoutReceipt: string[];
    earningsWithoutIsrcCount: number;
}

/**
 * ISSUE-1725: `users/{artistId}/splits` is not a payout source. It was
 * client-writable and no product code writes it, so its percentages and
 * Stripe account ids are unverified. Its presence blocks staging (fail
 * closed) instead of being honored or silently dropped.
 */
async function hasLegacySplitDocuments(firestore: FirebaseFirestore.Firestore, artistId: string): Promise<boolean> {
    const snapshot = await firestore.collection('users').doc(artistId).collection('splits').limit(1).get();
    return !snapshot.empty;
}

/** The artist is the only payee this tool can stage until signed share lines carry payee account bindings. */
async function readArtistRecipient(firestore: FirebaseFirestore.Firestore, artistId: string): Promise<PayoutRecipient> {
    const userSnap = await firestore.collection('users').doc(artistId).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const stripeAccountId = typeof userData.stripeAccountId === 'string' && userData.stripeAccountId.trim()
        ? userData.stripeAccountId.trim()
        : undefined;
    return { uid: artistId, percentage: 100, stripeAccountId };
}

/** Earnings ISRCs are stored hyphen-free and upper-case; receipt ISRCs keep release metadata's spelling. */
function normalizeIsrc(value: string): string {
    return value.replace(/-/g, '').trim().toUpperCase();
}

class LedgerScanLimitError extends Error {
    constructor() {
        super(`The admin ledger has more than ${MAX_LEDGER_RECEIPTS_SCANNED} receipts; split receipts could not be fully checked.`);
        this.name = 'LedgerScanLimitError';
    }
}

/**
 * Latest receipt per normalized ISRC by `lockedAt`. Matching happens in memory
 * because an exact-match query would miss a receipt whose ISRC is spelled
 * differently, letting a multi-party split slip through as "no receipt".
 * A receipt that fails the schema always wins so its earnings are held.
 */
async function readLatestLedgerReceiptsByIsrc(
    firestore: FirebaseFirestore.Firestore,
    artistId: string,
    isrcs: Set<string>,
): Promise<Map<string, { id: string; receipt: AdminLedgerReceipt | null; lockedAt: string }>> {
    const latest = new Map<string, { id: string; receipt: AdminLedgerReceipt | null; lockedAt: string }>();
    if (isrcs.size === 0) return latest;
    const snapshot = await firestore.collection('users').doc(artistId).collection('admin_ledger')
        .limit(MAX_LEDGER_RECEIPTS_SCANNED + 1)
        .get();
    if (snapshot.docs.length > MAX_LEDGER_RECEIPTS_SCANNED) throw new LedgerScanLimitError();
    snapshot.docs.forEach(doc => {
        const data = doc.data() || {};
        const rawIsrc = typeof data.identifiers?.isrc === 'string' ? data.identifiers.isrc : '';
        const isrc = normalizeIsrc(rawIsrc);
        if (!isrc || !isrcs.has(isrc)) return;
        const parsed = AdminLedgerReceiptSchema.safeParse(data);
        const lockedAt = typeof data.lockedAt === 'string' ? data.lockedAt : '';
        const current = latest.get(isrc);
        if (!parsed.success) {
            latest.set(isrc, { id: doc.id, receipt: null, lockedAt });
            return;
        }
        if (current && (current.receipt === null || current.lockedAt >= lockedAt)) return;
        latest.set(isrc, { id: doc.id, receipt: parsed.data, lockedAt });
    });
    return latest;
}

/**
 * Holds earnings whose locked split names more than one recording rights
 * holder: receipt share lines identify holders by legal name, not by payee
 * account, so paying them is impossible to do correctly yet. Earnings with no
 * receipt (or a sole-holder receipt) stay payable to the artist.
 */
async function classifyEarningsBySplitReceipt(
    firestore: FirebaseFirestore.Firestore,
    artistId: string,
    earnings: { isrc?: string; netMicros: number }[],
): Promise<SplitReceiptClassification> {
    const netByIsrc = new Map<string, number>();
    let payableNetMicros = 0;
    let earningsWithoutIsrcCount = 0;
    earnings.forEach(entry => {
        if (!entry.isrc) {
            earningsWithoutIsrcCount += 1;
            payableNetMicros += entry.netMicros;
            return;
        }
        netByIsrc.set(entry.isrc, (netByIsrc.get(entry.isrc) ?? 0) + entry.netMicros);
    });

    const receipts = await readLatestLedgerReceiptsByIsrc(firestore, artistId, new Set(netByIsrc.keys()));
    const held: HeldEarnings[] = [];
    const soleLineReceiptIds: string[] = [];
    const isrcsWithoutReceipt: string[] = [];
    [...netByIsrc.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([isrc, netMicros]) => {
        const match = receipts.get(isrc);
        if (!match) {
            isrcsWithoutReceipt.push(isrc);
            payableNetMicros += netMicros;
            return;
        }
        if (match.receipt === null) {
            held.push({ isrc, netMicros, reason: 'invalid_ledger_receipt', ledgerReceiptId: match.id });
            return;
        }
        if (match.receipt.splits.recording.length > 1) {
            held.push({ isrc, netMicros, reason: 'multi_party_locked_split', ledgerReceiptId: match.id });
            return;
        }
        soleLineReceiptIds.push(match.id);
        payableNetMicros += netMicros;
    });
    return { payableNetMicros, held, soleLineReceiptIds, isrcsWithoutReceipt, earningsWithoutIsrcCount };
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

/** Verifies the artist's Stripe account; the artist is the sole 100% recipient of the staged amount. */
async function resolveRecipient(recipient: PayoutRecipient, stagedNetMicros: number): Promise<ResolvedRecipient> {
    const amountMicros = stagedNetMicros;
    if (!recipient.stripeAccountId) {
        return { ...recipient, amountMicros, accountStatus: 'missing', blockReason: `No stripeAccountId on file for ${recipient.uid}.` };
    }
    const verification = await verifyStripeAccount(recipient.stripeAccountId);
    if (!verification.verified) {
        return { ...recipient, amountMicros, accountStatus: 'blocked', blockReason: verification.reason };
    }
    return { ...recipient, amountMicros, accountStatus: 'verified' };
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

            if (await hasLegacySplitDocuments(firestore, artistId)) {
                return toolResponse(failedOperationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    resourceType: RESOURCE_TYPE,
                    resourceId: 'none',
                    code: 'UNVERIFIED_SPLIT_DOCUMENTS',
                    message: `users/${artistId}/splits contains split documents that were not written by indii and cannot be verified. They are not a payout source. Record the split on a signed split sheet, then remove those documents; nothing was staged.`,
                    retryable: false,
                    warnings: [NO_MONEY_MOVED_WARNING],
                }));
            }

            let earningsNetMicros = 0;
            const earningsDocIds: string[] = [];
            const earningsByIsrc: { isrc?: string; netMicros: number }[] = [];
            matchedDocs.forEach(doc => {
                const data = doc.data() || {};
                const netMicros = ledgerMicros(data.netRevenueMicros, data.netRevenue);
                earningsNetMicros += netMicros;
                earningsDocIds.push(doc.id);
                const isrc = typeof data.isrc === 'string' && normalizeIsrc(data.isrc) ? normalizeIsrc(data.isrc) : undefined;
                earningsByIsrc.push({ isrc, netMicros });
            });

            const classification = await classifyEarningsBySplitReceipt(firestore, artistId, earningsByIsrc);
            const heldNetMicros = classification.held.reduce((total, entry) => total + entry.netMicros, 0);
            classification.held.forEach(entry => {
                warnings.push(entry.reason === 'multi_party_locked_split'
                    ? `HELD: ${entry.netMicros} micros for ISRC ${entry.isrc} — its locked split (${entry.ledgerReceiptId}) has more than one recording rights holder, and share lines are not yet bound to payee accounts. These earnings were not staged.`
                    : `HELD: ${entry.netMicros} micros for ISRC ${entry.isrc} — its admin ledger receipt ${entry.ledgerReceiptId} failed validation. These earnings were not staged.`);
            });
            if (classification.isrcsWithoutReceipt.length > 0) {
                warnings.push(`No locked split receipt exists for ${classification.isrcsWithoutReceipt.length} ISRC(s) (${classification.isrcsWithoutReceipt.slice(0, 10).join(', ')}${classification.isrcsWithoutReceipt.length > 10 ? ', …' : ''}); their earnings were staged to the artist as sole recipient. Confirm no collaborator is owed a share before approving.`);
            }
            if (classification.earningsWithoutIsrcCount > 0) {
                warnings.push(`${classification.earningsWithoutIsrcCount} earnings document(s) carry no ISRC, so no split receipt could be checked; they were staged to the artist as sole recipient. Confirm before approving.`);
            }

            let outstandingRecoupmentMicros = 0;
            balancesSnap.docs.forEach(doc => {
                const data = doc.data() || {};
                outstandingRecoupmentMicros += Math.max(0, ledgerMicros(data.balanceMicros, data.balance));
            });

            const stagedNetMicros = Math.max(0, classification.payableNetMicros - outstandingRecoupmentMicros);

            if (matchedDocs.length === 0 || stagedNetMicros <= 0) {
                warnings.push(
                    matchedDocs.length === 0
                        ? `No earnings documents matched artist ${artistId} for period ${payoutPeriod}; there is nothing to stage and no payout job was written.`
                        : classification.payableNetMicros <= 0
                            ? `All ${earningsNetMicros} micros of net earnings are held pending payee-bound splits; nothing to stage and no payout job was written.`
                            : `Payable net earnings (${classification.payableNetMicros} micros) do not exceed outstanding recoupment (${outstandingRecoupmentMicros} micros); nothing to stage and no payout job was written.`,
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
                        heldNetMicros,
                        outstandingRecoupmentMicros,
                    },
                }));
            }

            let persistedEarningsDocIds = earningsDocIds;
            if (earningsDocIds.length > MAX_EARNINGS_DOC_IDS) {
                persistedEarningsDocIds = earningsDocIds.slice(0, MAX_EARNINGS_DOC_IDS);
                warnings.push(`earningsDocIds truncated to ${MAX_EARNINGS_DOC_IDS} of ${earningsDocIds.length} contributing earnings documents on the payout job record.`);
            }

            // The artist is the sole recipient of every staged micro (held
            // multi-party earnings were excluded above). Verify the Stripe
            // Connect account is actually payout-capable. A missing or blocked
            // account is a BLOCKING warning, never a silent skip.
            const resolvedRecipients = [await resolveRecipient(await readArtistRecipient(firestore, artistId), stagedNetMicros)];
            const blockedRecipients = resolvedRecipients.filter((r) => r.accountStatus !== 'verified');
            blockedRecipients.forEach((r) => {
                warnings.push(`BLOCKING: recipient ${r.uid} (${r.percentage}%) cannot receive funds — ${r.blockReason}`);
            });
            const allBlocked = blockedRecipients.length === resolvedRecipients.length;
            const recordedHeld = classification.held.slice(0, MAX_HELD_EARNINGS_RECORDED);
            if (classification.held.length > MAX_HELD_EARNINGS_RECORDED) {
                warnings.push(`heldEarnings truncated to ${MAX_HELD_EARNINGS_RECORDED} of ${classification.held.length} held ISRCs on the payout batch record.`);
            }

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
                heldNetMicros,
                heldEarnings: recordedHeld,
                recipientSource: 'artist_sole',
                ledgerReceiptIds: classification.soleLineReceiptIds,
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
                    heldNetMicros,
                    heldEarnings: recordedHeld,
                    outstandingRecoupmentMicros,
                    recipients: batchRecipients,
                    status: allBlocked ? 'blocked_no_verified_recipients' : 'staged_pending_approval',
                },
            }));
        } catch (error) {
            if (error instanceof LedgerScanLimitError) {
                return toolResponse(failedOperationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    resourceType: RESOURCE_TYPE,
                    resourceId: 'none',
                    code: 'LEDGER_SCAN_LIMIT',
                    message: `${error.message} Nothing was staged.`,
                    retryable: false,
                    warnings: [NO_MONEY_MOVED_WARNING],
                }));
            }
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
