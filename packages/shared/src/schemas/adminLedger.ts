import { z } from 'zod';
import { TOTAL_SHARE_UNITS } from '../finance/shareUnits.js';

/**
 * AdminLedgerReceipt — the immutable, content-addressed summary written when a
 * master reaches ADMIN_LOCKED (Post-Mastering Administrative Engine, P1; plan §1.3).
 *
 * Document id: `led_v1_{sha256(canonicalReceiptJson)[:40]}` — identical payloads
 * collapse to the identical receipt. Firestore rules make this collection
 * read-only for clients (`allow write: if false`); the Admin SDK writes it.
 * Receipts chain via prevReceiptHash (auditLogChain precedent).
 */

export const ADMIN_LEDGER_RECEIPT_SCHEMA_VERSION = 'admin-ledger-receipt.v1';

export const LedgerShareLineSchema = z
    .object({
        collaboratorId: z.string().min(1).max(160),
        /** Exact basis-point share units; per-stream totals MUST be 1,000,000. */
        shareBasisUnits: z.number().int().nonnegative(),
    })
    .strict();
export type LedgerShareLine = z.infer<typeof LedgerShareLineSchema>;

export const LedgerSignatorySchema = z
    .object({
        collaboratorId: z.string().min(1).max(160),
        method: z.string().min(1).max(64),
        signedAt: z.string().datetime(),
        /** sha256 of the signed artifact this signatory approved. */
        receiptHash: z.string().regex(/^[0-9a-f]{8,64}$/),
    })
    .strict();
export type LedgerSignatory = z.infer<typeof LedgerSignatorySchema>;

export const LedgerIdentifiersSchema = z
    .object({
        isrc: z.string().max(16).optional(),
        iswc: z.string().max(16).optional(),
        upc: z.string().max(14).optional(),
        ipi: z.array(z.string().min(1).max(32)).max(50).optional(),
    })
    .strict();
export type LedgerIdentifiers = z.infer<typeof LedgerIdentifiersSchema>;

export const AdminLedgerReceiptSchema = z
    .object({
        id: z.string().regex(/^led_v1_[0-9a-f]{8,40}$/),
        userId: z.string().min(1).max(128),
        schemaVersion: z.literal(ADMIN_LEDGER_RECEIPT_SCHEMA_VERSION),
        masterHash: z.string().regex(/^[0-9a-f]{16,64}$/),
        /** Digit string — GCS generations are uint64 and exceed MAX_SAFE_INTEGER. */
        storageGeneration: z.string().regex(/^\d{1,20}$/),
        splits: z
            .object({
                recording: z.array(LedgerShareLineSchema).min(1).max(200),
                publishing: z.array(LedgerShareLineSchema).min(1).max(200),
            })
            .strict(),
        signatories: z.array(LedgerSignatorySchema).max(200),
        identifiers: LedgerIdentifiersSchema,
        /** sha256 of the validated ERN 4.3 payload (set at DISTRIBUTION_READY prep). */
        ernDigest: z.string().regex(/^[0-9a-f]{8,64}$/).optional(),
        /** Hash-chain link to the previous receipt for this owner, when one exists. */
        prevReceiptHash: z.string().regex(/^[0-9a-f]{8,64}$/).optional(),
        lockedAt: z.string().datetime(),
    })
    .strict()
    .superRefine((receipt, ctx) => {
        const sumStream = (lines: { shareBasisUnits: number }[]): number =>
            lines.reduce((total, line) => total + line.shareBasisUnits, 0);
        if (sumStream(receipt.splits.recording) !== TOTAL_SHARE_UNITS) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['splits', 'recording'],
                message: 'Recording share units must total exactly 1,000,000 (100.00%).',
            });
        }
        if (sumStream(receipt.splits.publishing) !== TOTAL_SHARE_UNITS) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['splits', 'publishing'],
                message: 'Publishing share units must total exactly 1,000,000 (100.00%).',
            });
        }
        const signedCollaborators = new Set(receipt.signatories.map((s) => s.collaboratorId));
        for (const line of [...receipt.splits.recording, ...receipt.splits.publishing]) {
            if (!signedCollaborators.has(line.collaboratorId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['signatories'],
                    message: `Rights holder ${line.collaboratorId} holds shares but has no signed receipt.`,
                });
                return;
            }
        }
    });

export type AdminLedgerReceipt = z.infer<typeof AdminLedgerReceiptSchema>;
