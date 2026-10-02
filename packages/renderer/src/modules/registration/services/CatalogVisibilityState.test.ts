import { describe, expect, it } from 'vitest';
import { parseCatalogVisibilityState } from './CatalogVisibilityState';

const hash = 'a'.repeat(64);
const state = { userId: 'owner', masterHash: hash, lifecycle: 'ADMIN_LOCKED', ledgerReceiptId: 'receipt' };

describe('catalog visibility record boundary (structural)', () => {
    it('defaults an owner-bound locked master to private', () => {
        expect(parseCatalogVisibilityState('owner', hash, state).catalogVisibility).toBe('private');
    });
    it('rejects mismatched owners and document identities', () => {
        expect(() => parseCatalogVisibilityState('other', hash, state)).toThrow();
        expect(() => parseCatalogVisibilityState('owner', 'b'.repeat(64), state)).toThrow();
    });
    it('rejects unlocked, receiptless and unsupported visibility records', () => {
        for (const override of [{ lifecycle: 'INGESTED' }, { ledgerReceiptId: undefined }, { catalogVisibility: 'link' }]) {
            expect(() => parseCatalogVisibilityState('owner', hash, { ...state, ...override })).toThrow();
        }
    });
});
