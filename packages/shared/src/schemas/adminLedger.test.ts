import { describe, expect, it } from 'vitest';
import {
    ADMIN_LEDGER_RECEIPT_SCHEMA_VERSION,
    AdminLedgerReceiptSchema,
} from './adminLedger.js';
import { TOTAL_SHARE_UNITS } from '../finance/shareUnits.js';

const NOW = new Date('2026-09-26T12:00:00.000Z').toISOString();
const HALF = TOTAL_SHARE_UNITS / 2;

function receipt(overrides: Record<string, unknown> = {}) {
    return {
        id: `led_v1_${'c'.repeat(40)}`.slice(0, 47), // led_v1_ + 40 hex = 47 chars
        userId: 'user-1',
        schemaVersion: ADMIN_LEDGER_RECEIPT_SCHEMA_VERSION,
        masterHash: 'a'.repeat(40),
        storageGeneration: '17273000000000000',
        splits: {
            recording: [
                { collaboratorId: 'artist-1', shareBasisUnits: HALF },
                { collaboratorId: 'producer-1', shareBasisUnits: TOTAL_SHARE_UNITS - HALF },
            ],
            publishing: [
                { collaboratorId: 'artist-1', shareBasisUnits: HALF },
                { collaboratorId: 'writer-1', shareBasisUnits: TOTAL_SHARE_UNITS - HALF },
            ],
        },
        signatories: [
            { collaboratorId: 'artist-1', method: 'pandadoc', signedAt: NOW, receiptHash: 'd'.repeat(40) },
            { collaboratorId: 'producer-1', method: 'in-app', signedAt: NOW, receiptHash: 'e'.repeat(40) },
            { collaboratorId: 'writer-1', method: 'in-app', signedAt: NOW, receiptHash: 'f'.repeat(40) },
        ],
        identifiers: { isrc: 'USABC7123456', ipi: ['000141073289'] },
        lockedAt: NOW,
        ...overrides,
    };
}

describe('AdminLedgerReceiptSchema', () => {
    it('accepts a fully-signed receipt whose streams each total exactly 1,000,000 units', () => {
        expect(AdminLedgerReceiptSchema.safeParse(receipt()).success).toBe(true);
    });

    it('rejects a recording stream that does not total the whole', () => {
        const bad = receipt({
            splits: {
                recording: [{ collaboratorId: 'artist-1', shareBasisUnits: TOTAL_SHARE_UNITS - 1 }],
                publishing: [{ collaboratorId: 'artist-1', shareBasisUnits: TOTAL_SHARE_UNITS }],
            },
            signatories: [
                { collaboratorId: 'artist-1', method: 'pandadoc', signedAt: NOW, receiptHash: 'd'.repeat(40) },
            ],
        });
        expect(AdminLedgerReceiptSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects a publishing stream that does not total the whole', () => {
        const base = receipt();
        const bad = {
            ...base,
            splits: {
                ...base.splits,
                publishing: [{ collaboratorId: 'artist-1', shareBasisUnits: TOTAL_SHARE_UNITS + 1 }],
            },
        };
        expect(AdminLedgerReceiptSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects unsigned rights holders — every shareholder must have a signed receipt', () => {
        const bad = receipt({ signatories: [receipt().signatories[0]] }); // producer-1/writer-1 unsigned
        const result = AdminLedgerReceiptSchema.safeParse(bad);
        expect(result.success).toBe(false);
    });

    it('rejects fractional share units (fixed-point only)', () => {
        const base = receipt();
        const bad = {
            ...base,
            splits: {
                ...base.splits,
                recording: [{ collaboratorId: 'artist-1', shareBasisUnits: 333333.5 }, { collaboratorId: 'producer-1', shareBasisUnits: TOTAL_SHARE_UNITS - 333333.5 }],
            },
        };
        expect(AdminLedgerReceiptSchema.safeParse(bad).success).toBe(false);
    });

    it('enforces the led_v1_ content-addressed id shape', () => {
        expect(AdminLedgerReceiptSchema.safeParse(receipt({ id: 'random-id' })).success).toBe(false);
        expect(AdminLedgerReceiptSchema.safeParse(receipt({ id: 'led_v2_cccc' })).success).toBe(false);
    });
});
