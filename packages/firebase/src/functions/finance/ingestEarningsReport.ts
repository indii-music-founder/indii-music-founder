import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateAppCheckV2 } from '../../middleware/appCheck';

const MAX_TRANSACTIONS = 5_000;
const MAX_BATCH_WRITES = 450;
const MONEY_SCALE = 1_000_000;
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
const USAGE_TYPES = new Set(['OnDemandStream', 'ProgrammedStream', 'Download', 'RingtoneDownload', 'Other']);

interface EarningsTransaction {
    transactionId: string;
    isrc: string;
    usageType: string;
    usageCount: number;
    revenueMicros: number;
    currencyCode: string;
    territoryCode: string;
    serviceName?: string;
}

interface SanitizedEarningsReport {
    reportId: string;
    senderId: string;
    recipientId: string;
    reportingPeriod: { startDate: string; endDate: string };
    reportCreatedDateTime: string;
    currencyCode: string;
    summary: { totalUsageCount: number; totalRevenueMicros: number };
    transactions: EarningsTransaction[];
}

interface DocumentSnapshotLike {
    exists: boolean;
    data(): Record<string, unknown>;
}

interface DocumentReferenceLike {
    path: string;
    get(): Promise<DocumentSnapshotLike>;
}

interface QueryDocumentLike {
    id: string;
    data(): Record<string, unknown>;
}

interface QueryLike {
    get(): Promise<{ docs: QueryDocumentLike[] }>;
}

interface TrackCollectionLike {
    where(field: string, operator: 'in', values: string[]): QueryLike;
}

interface UserDocumentLike {
    collection(name: 'tracks'): TrackCollectionLike;
}

interface CollectionLike {
    doc(id: string): DocumentReferenceLike & Partial<UserDocumentLike>;
}

interface EarningsFirestore {
    collection(name: string): CollectionLike;
    batch(): {
        set(target: { path: string }, data: Record<string, unknown>, options?: { merge: boolean }): void;
        commit(): Promise<void>;
    };
}

export interface EarningsIngestionResponse {
    success: true;
    batchId: string;
    totalRevenue: number;
    transactionCount: number;
    matchedReleases: number;
    unmatchedISRCs: string[];
    alreadyProcessed: boolean;
}

function requiredString(value: unknown, field: string, maxLength = 240): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new HttpsError('invalid-argument', `${field} is required.`);
    }
    return value.trim().slice(0, maxLength);
}

function finiteNumber(value: unknown, field: string, minimum: number, maximum: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw new HttpsError('invalid-argument', `${field} is invalid.`);
    }
    return value;
}

function dateString(value: unknown, field: string): string {
    const text = requiredString(value, field, 40);
    if (!Number.isFinite(Date.parse(text))) {
        throw new HttpsError('invalid-argument', `${field} is not a valid date.`);
    }
    return text;
}

function toMicros(amount: number): number {
    return Math.round(amount * MONEY_SCALE);
}

function fromMicros(amount: number): number {
    return amount / MONEY_SCALE;
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new HttpsError('invalid-argument', `${field} must be an object.`);
    }
    return value as Record<string, unknown>;
}

export function sanitizeEarningsReport(raw: unknown): SanitizedEarningsReport {
    const report = objectValue(raw, 'report');
    const period = objectValue(report.reportingPeriod, 'report.reportingPeriod');
    const summary = objectValue(report.summary, 'report.summary');
    const currencyCode = requiredString(report.currencyCode, 'report.currencyCode', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
        throw new HttpsError('invalid-argument', 'report.currencyCode must be ISO 4217 format.');
    }

    if (!Array.isArray(report.transactions) || report.transactions.length === 0 || report.transactions.length > MAX_TRANSACTIONS) {
        throw new HttpsError('invalid-argument', `report.transactions must contain 1-${MAX_TRANSACTIONS} rows.`);
    }

    const seenTransactionIds = new Set<string>();
    const transactions = report.transactions.map((rawTransaction, index): EarningsTransaction => {
        const transaction = objectValue(rawTransaction, `report.transactions[${index}]`);
        const resourceId = objectValue(transaction.resourceId, `report.transactions[${index}].resourceId`);
        const transactionId = requiredString(transaction.transactionId, `report.transactions[${index}].transactionId`, 160);
        if (seenTransactionIds.has(transactionId)) {
            throw new HttpsError('invalid-argument', `Duplicate transactionId: ${transactionId}.`);
        }
        seenTransactionIds.add(transactionId);

        const isrc = requiredString(resourceId.isrc, `report.transactions[${index}].ISRC`, 20)
            .replace(/-/g, '')
            .toUpperCase();
        if (!ISRC_PATTERN.test(isrc)) {
            throw new HttpsError('invalid-argument', `report.transactions[${index}].ISRC is invalid.`);
        }

        const usageType = requiredString(transaction.usageType, `report.transactions[${index}].usageType`, 40);
        if (!USAGE_TYPES.has(usageType)) {
            throw new HttpsError('invalid-argument', `report.transactions[${index}].usageType is invalid.`);
        }
        const usageCount = finiteNumber(transaction.usageCount, `report.transactions[${index}].usageCount`, 0, 1_000_000_000);
        if (!Number.isInteger(usageCount)) {
            throw new HttpsError('invalid-argument', `report.transactions[${index}].usageCount must be an integer.`);
        }
        const revenueAmount = finiteNumber(transaction.revenueAmount, `report.transactions[${index}].revenueAmount`, -1_000_000_000, 1_000_000_000);
        const rowCurrency = requiredString(transaction.currencyCode, `report.transactions[${index}].currencyCode`, 3).toUpperCase();
        if (rowCurrency !== currencyCode) {
            throw new HttpsError('invalid-argument', `report.transactions[${index}] currency does not match report currency.`);
        }

        return {
            transactionId,
            isrc,
            usageType,
            usageCount,
            revenueMicros: toMicros(revenueAmount),
            currencyCode: rowCurrency,
            territoryCode: requiredString(transaction.territoryCode, `report.transactions[${index}].territoryCode`, 8).toUpperCase(),
            serviceName: typeof transaction.serviceName === 'string' ? transaction.serviceName.trim().slice(0, 160) : undefined,
        };
    });

    const totalRevenueMicros = toMicros(finiteNumber(summary.totalRevenue, 'report.summary.totalRevenue', -1_000_000_000, 1_000_000_000));
    const rowRevenueMicros = transactions.reduce((total, transaction) => total + transaction.revenueMicros, 0);
    if (Math.abs(totalRevenueMicros - rowRevenueMicros) > 10_000) {
        throw new HttpsError('invalid-argument', 'report.summary.totalRevenue does not reconcile to transaction rows.');
    }

    const totalUsageCount = finiteNumber(summary.totalUsageCount, 'report.summary.totalUsageCount', 0, Number.MAX_SAFE_INTEGER);
    const rowUsageCount = transactions.reduce((total, transaction) => total + transaction.usageCount, 0);
    if (!Number.isInteger(totalUsageCount) || totalUsageCount !== rowUsageCount) {
        throw new HttpsError('invalid-argument', 'report.summary.totalUsageCount does not reconcile to transaction rows.');
    }

    return {
        reportId: requiredString(report.reportId, 'report.reportId', 160),
        senderId: requiredString(report.senderId, 'report.senderId', 160),
        recipientId: requiredString(report.recipientId, 'report.recipientId', 160),
        reportingPeriod: {
            startDate: dateString(period.startDate, 'report.reportingPeriod.startDate'),
            endDate: dateString(period.endDate, 'report.reportingPeriod.endDate'),
        },
        reportCreatedDateTime: dateString(report.reportCreatedDateTime, 'report.reportCreatedDateTime'),
        currencyCode,
        summary: { totalUsageCount, totalRevenueMicros },
        transactions,
    };
}

function stableId(...parts: string[]): string {
    return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function distributorId(senderId: string): string {
    const known: Record<string, string> = {
        PADPIDA2012110501U: 'merlin',
        PADPIDA2011112001R: 'spotify',
        PADPIDA200911030: 'apple',
        PADPIDA2011110101: 'amazon',
        PADPIDA2014042201H: 'tidal',
        PADPIDA2009060301Q: 'deezer',
        PADPIDA2013021901W: 'distrokid',
        PADPIDA2009090203U: 'tunecore',
        PADPIDA20061109026: 'cdbaby',
        PADPIDA2011030901S: 'symphonic',
    };
    return known[senderId] ?? `sender_${stableId(senderId).slice(0, 16)}`;
}

export async function processEarningsReport(
    userId: string,
    rawReport: unknown,
    firestore = admin.firestore() as unknown as EarningsFirestore
): Promise<EarningsIngestionResponse> {
    const report = sanitizeEarningsReport(rawReport);
    const configuredRecipient = process.env.DDEX_SENDER_PARTY_ID?.trim();
    if (configuredRecipient && report.recipientId !== configuredRecipient) {
        throw new HttpsError('failed-precondition', 'The earnings report recipient does not match this DDEX party.');
    }

    const batchId = `dsr_${stableId(userId, report.senderId, report.reportId).slice(0, 48)}`;
    const receiptRef = firestore.collection('dsr_processed_reports').doc(batchId);
    const existing = await receiptRef.get();
    if (existing.exists) {
        const data = existing.data();
        return {
            success: true,
            batchId,
            totalRevenue: Number(data.totalRevenue ?? fromMicros(report.summary.totalRevenueMicros)),
            transactionCount: Number(data.transactionCount ?? report.transactions.length),
            matchedReleases: Number((data.royaltiesSummary as Record<string, unknown> | undefined)?.count ?? 0),
            unmatchedISRCs: Array.isArray(data.unmatchedISRCs) ? data.unmatchedISRCs as string[] : [],
            alreadyProcessed: true,
        };
    }

    const requestedISRCs = [...new Set(report.transactions.map(transaction => transaction.isrc))];
    const catalog = new Map<string, { id: string; data: Record<string, unknown> }>();
    const trackCollection = (firestore.collection('users').doc(userId).collection?.('tracks'));
    if (!trackCollection) throw new HttpsError('internal', 'Unable to access the owner track catalog.');

    for (let index = 0; index < requestedISRCs.length; index += 30) {
        const chunk = requestedISRCs.slice(index, index + 30);
        const snapshot = await trackCollection.where('isrc', 'in', chunk).get();
        snapshot.docs.forEach(track => {
            const data = track.data();
            if (typeof data.isrc === 'string') {
                catalog.set(data.isrc.replace(/-/g, '').toUpperCase(), { id: track.id, data });
            }
        });
    }

    interface Aggregate {
        isrc: string;
        streams: number;
        downloads: number;
        grossRevenueMicros: number;
        track: { id: string; data: Record<string, unknown> };
    }
    const aggregates = new Map<string, Aggregate>();
    report.transactions.forEach(transaction => {
        const track = catalog.get(transaction.isrc);
        if (!track) return;
        const aggregate = aggregates.get(transaction.isrc) ?? {
            isrc: transaction.isrc,
            streams: 0,
            downloads: 0,
            grossRevenueMicros: 0,
            track,
        };
        if (transaction.usageType === 'OnDemandStream' || transaction.usageType === 'ProgrammedStream') {
            aggregate.streams += transaction.usageCount;
        } else if (transaction.usageType === 'Download' || transaction.usageType === 'RingtoneDownload') {
            aggregate.downloads += transaction.usageCount;
        }
        aggregate.grossRevenueMicros += transaction.revenueMicros;
        aggregates.set(transaction.isrc, aggregate);
    });

    const unmatchedISRCs = requestedISRCs.filter(isrc => !catalog.has(isrc));
    const distId = distributorId(report.senderId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const earningsIds: string[] = [];
    const earningsWrites: Array<{ id: string; data: Record<string, unknown> }> = [];

    aggregates.forEach(aggregate => {
        const releaseId = typeof aggregate.track.data.upc === 'string' ? aggregate.track.data.upc : aggregate.track.id;
        const earningsId = `earn_${stableId(userId, report.senderId, report.reportId, aggregate.isrc).slice(0, 48)}`;
        earningsIds.push(earningsId);
        earningsWrites.push({ id: earningsId, data: {
            id: earningsId,
            userId,
            distributorId: distId,
            senderId: report.senderId,
            releaseId,
            trackId: aggregate.track.id,
            isrc: aggregate.isrc,
            period: report.reportingPeriod,
            streams: aggregate.streams,
            downloads: aggregate.downloads,
            grossRevenue: fromMicros(aggregate.grossRevenueMicros),
            distributorFee: 0,
            platformFee: 0,
            netRevenue: fromMicros(aggregate.grossRevenueMicros),
            currencyCode: report.currencyCode,
            sourceReceiptId: batchId,
            sourceTrust: 'user_uploaded_unverified',
            reconciliationStatus: 'pending_review',
            createdAt: timestamp,
            updatedAt: timestamp,
        } });
    });

    // Firestore commits accept at most 500 writes. Commit deterministic,
    // merge-safe earnings chunks first and the receipt last. If a chunk fails,
    // no receipt exists and retrying safely overwrites the same earnings ids.
    for (let index = 0; index < earningsWrites.length; index += MAX_BATCH_WRITES) {
        const earningsBatch = firestore.batch();
        earningsWrites.slice(index, index + MAX_BATCH_WRITES).forEach(write => {
            earningsBatch.set(firestore.collection('earnings').doc(write.id), write.data, { merge: true });
        });
        await earningsBatch.commit();
    }

    const receiptBatch = firestore.batch();
    receiptBatch.set(receiptRef, {
        id: batchId,
        userId,
        distributorId: distId,
        senderId: report.senderId,
        recipientId: report.recipientId,
        batchId,
        reportId: report.reportId,
        totalRevenue: fromMicros(report.summary.totalRevenueMicros),
        totalUsageCount: report.summary.totalUsageCount,
        transactionCount: report.transactions.length,
        reportPeriod: { start: report.reportingPeriod.startDate, end: report.reportingPeriod.endDate },
        reportCreatedDateTime: report.reportCreatedDateTime,
        currencyCode: report.currencyCode,
        earningsIds,
        matchedISRCs: [...aggregates.keys()],
        unmatchedISRCs,
        sourceTrust: 'user_uploaded_unverified',
        reconciliationStatus: 'pending_review',
        royaltiesSummary: {
            count: aggregates.size,
            totalGrossRevenue: [...aggregates.values()].reduce((total, aggregate) => total + fromMicros(aggregate.grossRevenueMicros), 0),
            totalNetRevenue: [...aggregates.values()].reduce((total, aggregate) => total + fromMicros(aggregate.grossRevenueMicros), 0),
        },
        processedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    await receiptBatch.commit();
    return {
        success: true,
        batchId,
        totalRevenue: fromMicros(report.summary.totalRevenueMicros),
        transactionCount: report.transactions.length,
        matchedReleases: aggregates.size,
        unmatchedISRCs,
        alreadyProcessed: false,
    };
}

export const ingestEarningsReport = onCall(
    { enforceAppCheck: false, timeoutSeconds: 120, memory: '512MiB' },
    async request => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Sign in to ingest an earnings report.');
        }
        return processEarningsReport(request.auth.uid, request.data?.report);
    }
);
