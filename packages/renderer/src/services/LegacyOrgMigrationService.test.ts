import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockCommit = vi.fn();
const mockBatchUpdate = vi.fn();
const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: 'user-123' } };

vi.mock('./firebase', () => ({
    db: {},
    get auth() { return mockAuth; }
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, name) => ({ name })),
    query: vi.fn((...args) => args),
    where: vi.fn((field, op, value) => ({ field, op, value })),
    limit: vi.fn((n) => ({ limit: n })),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    doc: vi.fn((_db, coll, id) => ({ coll, id })),
    writeBatch: vi.fn(() => ({ update: mockBatchUpdate, commit: mockCommit })),
}));

import { LegacyOrgMigrationService } from './LegacyOrgMigrationService';

const emptySnapshot = { empty: true, size: 0, docs: [] };

describe('LegacyOrgMigrationService (ISSUE-772 backfill)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.currentUser = { uid: 'user-123' };
        mockCommit.mockResolvedValue(undefined);
    });

    it('returns null when no user is signed in', async () => {
        mockAuth.currentUser = null;
        const result = await LegacyOrgMigrationService.run();
        expect(result).toBeNull();
        expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('is a no-op when no legacy docs exist (idempotent re-run)', async () => {
        mockGetDocs.mockResolvedValue(emptySnapshot);
        const result = await LegacyOrgMigrationService.run();
        expect(result).toEqual({ history: 0, sessions: 0 });
        expect(mockCommit).not.toHaveBeenCalled();
    });

    it("rewrites legacy 'org-default' docs to 'personal' in a batch", async () => {
        const legacyDocs = [{ id: 'item-1' }, { id: 'item-2' }];
        mockGetDocs
            // history: one page then empty is implied by size < BATCH_SIZE
            .mockResolvedValueOnce({ empty: false, size: 2, docs: legacyDocs })
            // sessions: nothing to migrate
            .mockResolvedValueOnce(emptySnapshot);

        const result = await LegacyOrgMigrationService.run();

        expect(result).toEqual({ history: 2, sessions: 0 });
        expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
        expect(mockBatchUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'item-1' }),
            { orgId: 'personal' }
        );
        expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('swallows failures and returns null so app boot is never blocked', async () => {
        mockGetDocs.mockRejectedValue(new Error('offline'));
        const result = await LegacyOrgMigrationService.run();
        expect(result).toBeNull();
    });
});
