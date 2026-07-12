import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CatalogTrack } from '../types';

/**
 * ISSUE-970: when the external ASCAP submission succeeds (a real
 * confirmation/workId comes back) but our own durable Firestore record
 * fails to save, the adapter must report `localRecordFailed: true` —
 * never plain success (which would lose the fact nothing was saved
 * locally) and never plain failure (which would incorrectly imply the
 * registration itself didn't go through).
 */

const mocks = vi.hoisted(() => ({
    mockRegisterWithASCAP: vi.fn(),
    mockPersistOrgRecord: vi.fn(),
}));

vi.mock('@/services/rights/PRORightsService', () => ({
    registerWithASCAP: mocks.mockRegisterWithASCAP,
}));

vi.mock('../services/RegistrationPersistence', () => ({
    persistOrgRecord: mocks.mockPersistOrgRecord,
}));

import { AscapAdapter } from './AscapAdapter';

function makeTrack(): CatalogTrack {
    return {
        id: 'track-1',
        title: 'Test Song',
        artistName: 'Test Artist',
        writersAndContributors: [{ name: 'Test Writer', role: 'Composer', percentage: 100 }],
        isrc: 'US1234567890',
        isPublished: true,
    };
}

describe('AscapAdapter.submit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reports localRecordFailed when the external submission succeeds but the local write fails', async () => {
        mocks.mockRegisterWithASCAP.mockResolvedValue({ success: true, workId: 'ASCAP-WORK-123' });
        mocks.mockPersistOrgRecord.mockResolvedValue(false); // durable write failed

        const result = await AscapAdapter.submit({ workTitle: 'Test Song', ipiNumber: '123456789', writers: 'Test Writer' }, makeTrack(), 'user-1');

        expect(result.success).toBe(true);
        expect(result.confirmationNumber).toBe('ASCAP-WORK-123');
        expect(result.localRecordFailed).toBe(true);
    });

    it('does not flag localRecordFailed when the local write succeeds', async () => {
        mocks.mockRegisterWithASCAP.mockResolvedValue({ success: true, workId: 'ASCAP-WORK-456' });
        mocks.mockPersistOrgRecord.mockResolvedValue(true);

        const result = await AscapAdapter.submit({ workTitle: 'Test Song', ipiNumber: '123456789', writers: 'Test Writer' }, makeTrack(), 'user-1');

        expect(result.success).toBe(true);
        expect(result.localRecordFailed).toBeFalsy();
    });
});
