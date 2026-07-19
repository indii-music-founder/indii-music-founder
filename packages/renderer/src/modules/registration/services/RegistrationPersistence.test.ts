import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ISSUE-970: persistOrgRecord must report whether the durable write actually
 * succeeded instead of silently swallowing the failure and resolving void.
 */

const mocks = vi.hoisted(() => ({
    mockSetDoc: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({})),
    setDoc: mocks.mockSetDoc,
    serverTimestamp: () => 'MOCK_TIMESTAMP',
}));

import { persistOrgRecord } from './RegistrationPersistence';

describe('persistOrgRecord', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns true when the Firestore write succeeds', async () => {
        mocks.mockSetDoc.mockResolvedValue(undefined);

        const result = await persistOrgRecord('user-1', 'track-1', 'ascap', { workTitle: 'Song' }, 'CONF-123');

        expect(result).toBe(true);
    });

    it('returns false (never throws) when the Firestore write fails', async () => {
        mocks.mockSetDoc.mockRejectedValue(new Error('permission-denied'));

        const result = await persistOrgRecord('user-1', 'track-1', 'ascap', { workTitle: 'Song' }, 'CONF-123');

        expect(result).toBe(false);
    });
});
