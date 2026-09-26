import { describe, expect, it } from 'vitest';
import {
    advanceCursor,
    selectStaleMasterHashes,
    SWEEP_STALE_AFTER_MS,
} from './catalogAdminSweep.js';

describe('selectStaleMasterHashes (weekly sweep selection)', () => {
    const now = 1_800_000_000_000;
    const cutoff = now - SWEEP_STALE_AFTER_MS;

    it('selects only masters whose audit is older than the cutoff', () => {
        const masters = [
            { masterHash: 'stale', updatedAtMs: cutoff - 1 },
            { masterHash: 'fresh', updatedAtMs: cutoff + 1 },
            { masterHash: 'boundary-stale', updatedAtMs: cutoff - SWEEP_STALE_AFTER_MS },
        ];
        expect(selectStaleMasterHashes(masters, cutoff)).toEqual(['stale', 'boundary-stale']);
    });

    it('treats a missing/zero timestamp as stale (never-audited states get audited)', () => {
        expect(selectStaleMasterHashes([{ masterHash: 'never', updatedAtMs: 0 }], cutoff)).toEqual(['never']);
    });

    it('returns nothing for a fully fresh page', () => {
        expect(selectStaleMasterHashes([{ masterHash: 'fresh', updatedAtMs: now }], cutoff)).toEqual([]);
    });
});

describe('advanceCursor (resumable paging)', () => {
    it('advances to the page tail when the page had users', () => {
        const next = advanceCursor({ lastUserId: null, completedAt: null }, 'user-zz', false);
        expect(next).toMatchObject({ lastUserId: 'user-zz', completedAt: null });
    });

    it('resets the cursor and stamps completion when the page is empty (cycle end)', () => {
        const next = advanceCursor({ lastUserId: 'user-zz', completedAt: null }, null, true);
        expect(next.lastUserId).toBeNull();
        expect(next.completedAt).toBeTruthy();
    });
});
