/**
 * FirestoreFinanceRecoupmentLedger — Layer 2/3 Bridge (Finance Recoupment)
 *
 * Production Firestore-backed implementation of `IFinanceRecoupmentLedgerPort`.
 * Uses atomic Firestore transactions (`runTransaction`) to verify available
 * recoupment balance on `financeRecoupmentLedgers/{ledgerAccountId}`, create
 * immutable reservation records in `financeRecoupmentReservations/{reservationId}`,
 * commit actual provisioned ad spend (automatically refunding any unspent
 * cent delta back to the artist's recoupment account), or release the full
 * reservation if all platform adapters fail.
 */

import * as admin from 'firebase-admin';
import {
    type PlatformCampaignReceipt,
} from '../../types/ad-execution.types';
import {
    type FinanceRecoupmentLedgerEntry,
    type IFinanceRecoupmentLedgerPort,
} from './campaign-orchestrator';

export interface TransactionalDocSnapshot {
    exists: boolean;
    data(): Record<string, unknown> | undefined;
}

export interface TransactionalDocRef {
    readonly id: string;
    get(): Promise<TransactionalDocSnapshot>;
    set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
}

export interface TransactionalContext {
    get(ref: TransactionalDocRef): Promise<TransactionalDocSnapshot>;
    set(ref: TransactionalDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): void;
}

export interface TransactionalFirestoreDb {
    collection(name: string): {
        doc(id: string): TransactionalDocRef;
    };
    runTransaction<T>(updateFunction: (tx: TransactionalContext) => Promise<T>): Promise<T>;
}

export class FirestoreFinanceRecoupmentLedger implements IFinanceRecoupmentLedgerPort {
    private readonly dbResolver: () => TransactionalFirestoreDb;
    private readonly ledgersCollection: string;
    private readonly reservationsCollection: string;

    constructor(options?: {
        db?: TransactionalFirestoreDb;
        ledgersCollection?: string;
        reservationsCollection?: string;
    }) {
        this.dbResolver = options?.db
            ? () => options.db!
            : () => admin.firestore() as unknown as TransactionalFirestoreDb;
        this.ledgersCollection = options?.ledgersCollection ?? 'financeRecoupmentLedgers';
        this.reservationsCollection =
            options?.reservationsCollection ?? 'financeRecoupmentReservations';
    }

    private sanitizeId(raw: string): string {
        return raw.trim().replace(/\//g, '_');
    }

    async reserveCampaignBudget(input: {
        directiveId: string;
        artistId: string;
        ledgerAccountId: string;
        releaseId: string;
        isrc: string;
        currency: string;
        amountCents: number;
    }): Promise<FinanceRecoupmentLedgerEntry> {
        if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
            throw new Error(`Invalid reservation amountCents: ${input.amountCents}`);
        }

        const db = this.dbResolver();
        const accountDocId = this.sanitizeId(input.ledgerAccountId);
        const reservationId = this.sanitizeId(
            `res_${input.directiveId}_${input.ledgerAccountId}`,
        );

        const ledgerRef = db.collection(this.ledgersCollection).doc(accountDocId);
        const reservationRef = db.collection(this.reservationsCollection).doc(reservationId);

        return db.runTransaction(async (tx) => {
            const [existingReservation, ledgerSnap] = await Promise.all([
                tx.get(reservationRef),
                tx.get(ledgerRef),
            ]);

            if (existingReservation.exists) {
                const existingData = existingReservation.data() as
                    | FinanceRecoupmentLedgerEntry
                    | undefined;
                if (existingData && existingData.status !== 'RELEASED') {
                    return existingData;
                }
            }

            if (!ledgerSnap.exists) {
                throw new Error(
                    `Finance recoupment ledger ${input.ledgerAccountId} does not exist.`,
                );
            }

            const ledgerData = ledgerSnap.data() ?? {};
            const availableCents =
                typeof ledgerData.availableBalanceCents === 'number'
                    ? ledgerData.availableBalanceCents
                    : 0;

            if (availableCents < input.amountCents) {
                throw new Error(
                    `Insufficient recoupment ledger balance on ${input.ledgerAccountId}: requested ${input.amountCents} cents, available ${availableCents} cents.`,
                );
            }

            const nowIso = new Date().toISOString();
            const entry: FinanceRecoupmentLedgerEntry = {
                reservationId,
                directiveId: input.directiveId,
                artistId: input.artistId,
                ledgerAccountId: input.ledgerAccountId,
                releaseId: input.releaseId,
                isrc: input.isrc,
                currency: input.currency,
                reservedCents: input.amountCents,
                committedCents: 0,
                status: 'RESERVED',
                createdAtIso: nowIso,
                updatedAtIso: nowIso,
            };

            tx.set(
                ledgerRef,
                {
                    availableBalanceCents: availableCents - input.amountCents,
                    updatedAtIso: nowIso,
                },
                { merge: true },
            );

            tx.set(reservationRef, entry as unknown as Record<string, unknown>);
            return entry;
        });
    }

    async commitCampaignBudget(
        reservationId: string,
        committedCents: number,
        receipts: ReadonlyArray<PlatformCampaignReceipt>,
    ): Promise<FinanceRecoupmentLedgerEntry> {
        if (!Number.isInteger(committedCents) || committedCents < 0) {
            throw new Error(`Invalid committedCents: ${committedCents}`);
        }

        const db = this.dbResolver();
        const reservationRef = db
            .collection(this.reservationsCollection)
            .doc(this.sanitizeId(reservationId));

        return db.runTransaction(async (tx) => {
            const resSnap = await tx.get(reservationRef);
            if (!resSnap.exists) {
                throw new Error(`Ledger reservation ${reservationId} not found.`);
            }

            const entry = resSnap.data() as unknown as FinanceRecoupmentLedgerEntry;
            if (entry.status === 'COMMITTED') {
                return entry;
            }
            if (committedCents > entry.reservedCents) {
                throw new Error(
                    `Cannot commit ${committedCents} cents exceeding reserved ${entry.reservedCents} cents on ${reservationId}.`,
                );
            }

            const ledgerRef = db
                .collection(this.ledgersCollection)
                .doc(this.sanitizeId(entry.ledgerAccountId));
            const ledgerSnap = await tx.get(ledgerRef);
            const currentAvailable =
                typeof ledgerSnap.data()?.availableBalanceCents === 'number'
                    ? (ledgerSnap.data()!.availableBalanceCents as number)
                    : 0;

            const refundCents = Math.max(0, entry.reservedCents - committedCents);
            const nowIso = new Date().toISOString();

            if (refundCents > 0) {
                tx.set(
                    ledgerRef,
                    {
                        availableBalanceCents: currentAvailable + refundCents,
                        updatedAtIso: nowIso,
                    },
                    { merge: true },
                );
            }

            const updated: FinanceRecoupmentLedgerEntry = {
                ...entry,
                committedCents,
                status: committedCents > 0 ? 'COMMITTED' : 'RELEASED',
                updatedAtIso: nowIso,
            };

            tx.set(
                reservationRef,
                {
                    ...updated,
                    platformReceiptIds: receipts.map(r => ({
                        platform: r.platform,
                        externalCampaignId: r.externalCampaignId,
                        committedBudgetCents: r.committedBudgetCents,
                    })),
                },
                { merge: true },
            );

            return updated;
        });
    }

    async releaseCampaignBudget(reservationId: string, reason: string): Promise<void> {
        const db = this.dbResolver();
        const reservationRef = db
            .collection(this.reservationsCollection)
            .doc(this.sanitizeId(reservationId));

        await db.runTransaction(async (tx) => {
            const resSnap = await tx.get(reservationRef);
            if (!resSnap.exists) return;

            const entry = resSnap.data() as unknown as FinanceRecoupmentLedgerEntry;
            if (entry.status === 'RELEASED') return;

            const ledgerRef = db
                .collection(this.ledgersCollection)
                .doc(this.sanitizeId(entry.ledgerAccountId));
            const ledgerSnap = await tx.get(ledgerRef);
            const currentAvailable =
                typeof ledgerSnap.data()?.availableBalanceCents === 'number'
                    ? (ledgerSnap.data()!.availableBalanceCents as number)
                    : 0;

            const refundCents = Math.max(0, entry.reservedCents - entry.committedCents);
            const nowIso = new Date().toISOString();

            tx.set(
                ledgerRef,
                {
                    availableBalanceCents: currentAvailable + refundCents,
                    updatedAtIso: nowIso,
                },
                { merge: true },
            );

            tx.set(
                reservationRef,
                {
                    status: 'RELEASED',
                    releaseReason: reason,
                    updatedAtIso: nowIso,
                },
                { merge: true },
            );
        });
    }
}
