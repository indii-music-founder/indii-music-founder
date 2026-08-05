import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ARTIST_OPERATING_PROFILE } from '@shared';

vi.mock('@/utils/e2eMode', () => ({ isFirebaseE2EMockEnabled: vi.fn(() => false) }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((...args: unknown[]) => ({ path: args.join('/') })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

let currentUid: string | null = 'artist-1';
vi.mock('@/services/firebase', () => ({ db: {}, auth: { get currentUser() { return currentUid ? { uid: currentUid } : null; } } }));
vi.mock('@/utils/authGuards', () => ({ getRealAuthenticatedUserId: (u: { uid: string } | null) => u?.uid ?? null }));

import { artistOperatingProfileService } from '../ArtistOperatingProfileService';

describe('ArtistOperatingProfileService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUid = 'artist-1';
    });

    describe('getProfile', () => {
        it('returns defaults (fail-closed) when unauthenticated', async () => {
            currentUid = null;
            const profile = await artistOperatingProfileService.getProfile();
            expect(profile).toEqual(DEFAULT_ARTIST_OPERATING_PROFILE);
            expect(mockGetDoc).not.toHaveBeenCalled();
        });

        it('returns defaults when no doc has ever been saved', async () => {
            mockGetDoc.mockResolvedValueOnce({ exists: () => false });
            const profile = await artistOperatingProfileService.getProfile();
            expect(profile).toEqual(DEFAULT_ARTIST_OPERATING_PROFILE);
        });

        it('returns the parsed stored profile when present', async () => {
            const stored = {
                schemaVersion: 'artist-operating-profile.v1',
                businessGoals: ['Grow email list'],
                creativeBoundaries: [],
                installedSoftware: [],
                connectedServiceIds: [],
                permissions: { autonomousComputerControl: true, allowDestructiveTools: false, preApprovedToolNames: [] },
            };
            mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => stored });
            const profile = await artistOperatingProfileService.getProfile();
            expect(profile.businessGoals).toEqual(['Grow email list']);
            expect(profile.permissions.autonomousComputerControl).toBe(true);
        });

        it('falls back to defaults (fail-closed) when the stored doc fails schema validation', async () => {
            mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ garbage: true }) });
            const profile = await artistOperatingProfileService.getProfile();
            expect(profile).toEqual(DEFAULT_ARTIST_OPERATING_PROFILE);
        });

        it('falls back to defaults (fail-closed) when the read throws', async () => {
            mockGetDoc.mockRejectedValueOnce(new Error('offline'));
            const profile = await artistOperatingProfileService.getProfile();
            expect(profile).toEqual(DEFAULT_ARTIST_OPERATING_PROFILE);
        });
    });

    describe('updateProfile', () => {
        it('throws when unauthenticated', async () => {
            currentUid = null;
            await expect(artistOperatingProfileService.updateProfile({ businessGoals: ['x'] })).rejects.toThrow('Not authenticated');
        });

        it('merges updates into the current profile and persists via setDoc', async () => {
            mockGetDoc.mockResolvedValueOnce({ exists: () => false });
            const next = await artistOperatingProfileService.updateProfile({
                permissions: { autonomousComputerControl: true, allowDestructiveTools: false, preApprovedToolNames: [] },
            });
            expect(next.permissions.autonomousComputerControl).toBe(true);
            expect(mockSetDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ updatedAt: 'SERVER_TIMESTAMP', permissions: expect.objectContaining({ autonomousComputerControl: true }) }),
            );
        });
    });

    describe('onProfileChange', () => {
        it('emits defaults immediately when unauthenticated, no subscription created', () => {
            currentUid = null;
            const callback = vi.fn();
            const unsub = artistOperatingProfileService.onProfileChange(callback);
            expect(callback).toHaveBeenCalledWith(DEFAULT_ARTIST_OPERATING_PROFILE);
            expect(mockOnSnapshot).not.toHaveBeenCalled();
            expect(typeof unsub).toBe('function');
        });

        it('subscribes via onSnapshot when authenticated', () => {
            const callback = vi.fn();
            mockOnSnapshot.mockReturnValueOnce(() => {});
            artistOperatingProfileService.onProfileChange(callback);
            expect(mockOnSnapshot).toHaveBeenCalled();
        });
    });
});
