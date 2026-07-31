import { describe, expect, it, vi } from 'vitest';

const { mockCollectionGroup } = vi.hoisted(() => ({
    mockCollectionGroup: vi.fn(),
}));
vi.mock('firebase-admin', () => ({
    firestore: () => ({ collectionGroup: mockCollectionGroup }),
}));
vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: vi.fn((opts, handler) => ({ run: handler })) }));
vi.mock('firebase-functions/params', () => ({ defineSecret: () => ({ value: () => 'fake-secret' }) }));
vi.mock('inngest', () => ({ Inngest: vi.fn() }));

import { isMissingIndexError, pollTimelineMilestones } from './pollTimelineMilestones';

describe('isMissingIndexError (ISSUE-1220)', () => {
    it('recognises the real production error that hid this bug', () => {
        // Verbatim from Cloud Run logs, 2026-07-24T01:57:05Z.
        const real = new Error(
            '9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index'
            + ' for collection items and field status. You can create it here:'
            + ' https://console.firebase.google.com/v1/r/project/indii-music-founder/firestore/indexes?create_exemption=abc',
        );
        expect(isMissingIndexError(real)).toBe(true);
    });

    it('does not classify an unrelated FAILED_PRECONDITION as a provisioning problem', () => {
        // Misdiagnosing this would send the next reader to rebuild an index
        // while the actual bug sits untouched.
        const unrelated = new Error('9 FAILED_PRECONDITION: The document does not exist.');
        expect(isMissingIndexError(unrelated)).toBe(false);
    });

    it('does not classify an error that merely mentions indexes without FAILED_PRECONDITION', () => {
        expect(isMissingIndexError(new Error('Array index out of bounds'))).toBe(false);
    });

    it('handles non-Error throwables without crashing the handler', () => {
        expect(isMissingIndexError('9 FAILED_PRECONDITION: requires an index')).toBe(true);
        expect(isMissingIndexError(null)).toBe(false);
        expect(isMissingIndexError(undefined)).toBe(false);
        expect(isMissingIndexError({ code: 9 })).toBe(false);
    });

    it('matches `index` as a whole word, not as a substring of another token', () => {
        // Guards the regex itself: `indexed`/`indexing` in an unrelated
        // FAILED_PRECONDITION should not trigger the provisioning message.
        expect(
            isMissingIndexError(new Error('9 FAILED_PRECONDITION: document is being reindexed')),
        ).toBe(false);
    });

    it('completes a scheduled run without FAILED_PRECONDITION when index exists', async () => {
        // Mock a scheduled run to ensure completion after index finishes building (ISSUE-1220).
        const mockGet = vi.fn().mockResolvedValue({ size: 0, docs: [] });
        const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
        mockCollectionGroup.mockReturnValue({ where: mockWhere });
        
        // Execute the scheduled function. It should not throw.
        await expect((pollTimelineMilestones as any).run({} as any)).resolves.toBeUndefined();
    });
});
