import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MechanicalRoyaltyService } from './MechanicalRoyaltyService';
import { auth } from '@/services/firebase';
import { getDocs, setDoc, updateDoc, doc, collection } from 'firebase/firestore';

const mockCallableFns = {
    searchSongfile: vi.fn(),
    requestMechanicalLicense: vi.fn(),
};

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn((_functions, name: string) => {
        if (name === 'searchSongfile') {
            return mockCallableFns.searchSongfile;
        }
        if (name === 'requestMechanicalLicense') {
            return mockCallableFns.requestMechanicalLicense;
        }
        return vi.fn();
    }),
}));

vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
    return {
        ...actual,
        getDocs: vi.fn(),
        setDoc: vi.fn(),
        updateDoc: vi.fn(),
        collection: vi.fn(() => ({ id: 'mechanical_licenses' })),
        doc: vi.fn(() => ({ id: 'mock-doc' })),
        query: vi.fn(),
        where: vi.fn(),
        Timestamp: {
            now: vi.fn(() => ({ seconds: 123456789, nanoseconds: 0 })),
        },
        serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
    };
});

describe('MechanicalRoyaltyService', () => {
    const mockUid = 'test-user-id';
    const mockComposition = {
        title: 'Test Song',
        writers: ['Writer A'],
        publishers: ['Publisher A'],
        controlled: true,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-expect-error - Mocking readonly property
        auth.currentUser = { uid: mockUid };

        mockCallableFns.searchSongfile.mockResolvedValue({
            data: { result: mockComposition },
        });
        mockCallableFns.requestMechanicalLicense.mockResolvedValue({
            data: { result: { licenseNumber: 'HFA123' } },
        });
    });

    describe('searchComposition', () => {
        it('should fetch composition info via searchSongfile callable', async () => {
            const result = await MechanicalRoyaltyService.searchComposition('Test Song');
            expect(mockCallableFns.searchSongfile).toHaveBeenCalledWith({ title: 'Test Song' });
            expect(result).toEqual(mockComposition);
        });

        it('should return null if callable fails', async () => {
            mockCallableFns.searchSongfile.mockRejectedValueOnce(new Error('Network error'));
            const result = await MechanicalRoyaltyService.searchComposition('Test Song');
            expect(result).toBeNull();
        });
    });

    describe('createLicense', () => {
        it('should create a license record in Firestore under users/{uid}/mechanical_licenses', async () => {
            const params = {
                releaseId: 'rel_123',
                durationSeconds: 180,
                trackTitle: 'Test Song',
                composition: mockComposition,
            };

            const result = await MechanicalRoyaltyService.createLicense(params);

            expect(doc).toHaveBeenCalledWith(
                expect.anything(),
                'users',
                mockUid,
                'mechanical_licenses',
                expect.stringContaining(`ml_${mockUid}_`)
            );
            expect(setDoc).toHaveBeenCalled();
            expect(result.id).toBeDefined();
            expect(result.status).toBe('pending_search');
            expect(result.totalFee).toBeGreaterThan(0);
        });

        it('should throw error if not authenticated', async () => {
            // @ts-expect-error - Mocking readonly property
            auth.currentUser = null;
            await expect(MechanicalRoyaltyService.createLicense({
                releaseId: '123',
                durationSeconds: 180,
                trackTitle: 'T',
                composition: mockComposition
            })).rejects.toThrow('Not authenticated');
        });
    });

    describe('requestLicense', () => {
        it('should call the requestMechanicalLicense callable and update status', async () => {
            await MechanicalRoyaltyService.requestLicense('ml_123');

            expect(mockCallableFns.requestMechanicalLicense).toHaveBeenCalledWith({
                licenseId: 'ml_123',
                userId: mockUid,
            });
            expect(doc).toHaveBeenCalledWith(
                expect.anything(),
                'users',
                mockUid,
                'mechanical_licenses',
                'ml_123'
            );
            expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                status: 'license_requested',
                licenseNumber: 'HFA123',
            }));
        });
    });

    describe('getLicenses', () => {
        it('should query licenses from users/{uid}/mechanical_licenses', async () => {
            (getDocs as import("vitest").Mock).mockResolvedValueOnce({
                docs: [
                    { id: 'l1', data: () => ({ releaseId: 'r1', trackTitle: 'S1' }) }
                ]
            });

            const result = await MechanicalRoyaltyService.getLicenses('r1');
            expect(collection).toHaveBeenCalledWith(expect.anything(), 'users', mockUid, 'mechanical_licenses');
            expect(result).toHaveLength(1);
            expect(result?.[0]?.trackTitle).toBe('S1');
        });
    });

    describe('isReleaseClearedForDistribution', () => {
        it('should return status: cleared if no pending tracks', async () => {
            vi.spyOn(MechanicalRoyaltyService, 'getLicenses').mockResolvedValueOnce([
                { status: 'license_active', trackTitle: 'S1' } as unknown as Awaited<ReturnType<typeof MechanicalRoyaltyService.getLicenses>>[number]
            ]);

            const result = await MechanicalRoyaltyService.isReleaseClearedForDistribution('r1');
            expect(result.status).toBe('cleared');
        });

        it('should return status: pending if tracks are pending', async () => {
            vi.spyOn(MechanicalRoyaltyService, 'getLicenses').mockResolvedValueOnce([
                { status: 'pending_search', trackTitle: 'S1' } as unknown as Awaited<ReturnType<typeof MechanicalRoyaltyService.getLicenses>>[number]
            ]);

            const result = await MechanicalRoyaltyService.isReleaseClearedForDistribution('r1');
            expect(result.status).toBe('pending');
            expect(result.pendingTracks).toContain('S1');
        });

        it('should return status: unknown if getLicenses returns null', async () => {
            vi.spyOn(MechanicalRoyaltyService, 'getLicenses').mockResolvedValueOnce(null);

            const result = await MechanicalRoyaltyService.isReleaseClearedForDistribution('r1');
            expect(result.status).toBe('unknown');
        });
    });
});
