import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoadTools } from './RoadTools';

const mocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'user-1' } as { uid: string } | null },
    createDraft: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ auth: mocks.auth, db: {} }));
vi.mock('@/services/touring/SetlistDraftService', () => ({
    setlistDraftService: { create: mocks.createDraft },
}));
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateStructuredData: vi.fn() },
}));
vi.mock('./MapsTools', () => ({ MapsTools: {} }));
vi.mock('@/utils/dynamicImport', () => ({ importWithRetry: vi.fn() }));

describe('RoadTools log_live_setlist_for_pro', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'user-1' };
        mocks.createDraft.mockResolvedValue('draft-1');
    });

    it('reports success only after the authenticated draft is persisted', async () => {
        const result = await RoadTools.log_live_setlist_for_pro({
            venue: 'Test Venue',
            date: '2099-08-09',
            tracks: ['Song One'],
        });

        expect(mocks.createDraft).toHaveBeenCalledWith({
            userId: 'user-1',
            venue: 'Test Venue',
            date: '2099-08-09',
            city: '',
            attendance: 0,
            category: 'unclassified',
            songs: [{ id: 'track-1', title: 'Song One', originalArtist: '', type: 'other' }],
        });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({ setlistId: 'draft-1' }));
        expect(result.message).toContain('not submitted to a PRO');
    });

    it('returns a persistence error instead of a false success', async () => {
        mocks.createDraft.mockRejectedValueOnce(new Error('Firestore denied'));
        const result = await RoadTools.log_live_setlist_for_pro({
            venue: 'Test Venue',
            date: '2099-08-09',
            tracks: ['Song One'],
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('PERSISTENCE_ERROR');
    });

    it('rejects unauthenticated setlist writes', async () => {
        mocks.auth.currentUser = null;
        const result = await RoadTools.log_live_setlist_for_pro({
            venue: 'Test Venue',
            date: '2099-08-09',
            tracks: ['Song One'],
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
        expect(mocks.createDraft).not.toHaveBeenCalled();
    });
});
