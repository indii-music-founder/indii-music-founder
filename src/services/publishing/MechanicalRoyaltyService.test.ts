import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MechanicalRoyaltyService } from './MechanicalRoyaltyService';
import { auth } from '@/services/firebase';
import { getDocs, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

// Mock dependencies are handled by src/test/setup.ts
// We just need to mock the specific behaviors for these tests

vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual('firebase/firestore') as any;
    return {
        ...actual,
        getDocs: vi.fn(),
        setDoc: vi.fn(),
        updateDoc: vi.fn(),
        collection: vi.fn(() => ({ id: 'licenses' })),
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

        // Mock global fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: mockComposition }),
        });
    });

    describe('searchComposition', () => {
        it('should fetch composition info from API', async () => {
            const result = await MechanicalRoyaltyService.searchComposition('Test Song');
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('searchSongfile?title=Test+Song'));
            expect(result).toEqual(mockComposition);
        });

        it('should return null if API fails', async () => {
            (global.fetch as import("vitest").Mock).mockResolvedValueOnce({ ok: false, status: 500 });
            const result = await MechanicalRoyaltyService.searchComposition('Test Song');
            expect(result).toBeNull();
        });
    });

    describe('createLicense', () => {
        it('should create a license record in Firestore', async () => {
            const params = {
                releaseId: 'rel_123',
                trackTitle: 'Test Song',
                composition: mockComposition,
            };

            const result = await MechanicalRoyaltyService.createLicense(params);

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
                trackTitle: 'T',
                composition: mockComposition
            })).rejects.toThrow('Not authenticated');
        });
    });

    describe('requestLicense', () => {
        it('should call the proxy API and update status', async () => {
            (global.fetch as import("vitest").Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: { licenseNumber: 'HFA123' } }),
            });

            await MechanicalRoyaltyService.requestLicense('ml_123');

            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('requestMechanicalLicense'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseId: 'ml_123', userId: mockUid }),
            });
            expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                status: 'license_requested',
                licenseNumber: 'HFA123',
            }));
        });
    });

    describe('getLicenses', () => {
        it('should return licenses from Firestore', async () => {
            (getDocs as import("vitest").Mock).mockResolvedValueOnce({
                docs: [
                    { id: 'l1', data: () => ({ releaseId: 'r1', trackTitle: 'S1' }) }
                ]
            });

            const result = await MechanicalRoyaltyService.getLicenses('r1');
            expect(result).toHaveLength(1);
            expect(result[0]?.trackTitle).toBe('S1');
        });
    });

    describe('isReleaseClearedForDistribution', () => {
        it('should return cleared: true if no pending tracks', async () => {
            vi.spyOn(MechanicalRoyaltyService, 'getLicenses').mockResolvedValueOnce([
                { status: 'license_active', trackTitle: 'S1' } as any
            ]);

            const result = await MechanicalRoyaltyService.isReleaseClearedForDistribution('r1');
            expect(result.cleared).toBe(true);
        });

        it('should return cleared: false if tracks are pending', async () => {
            vi.spyOn(MechanicalRoyaltyService, 'getLicenses').mockResolvedValueOnce([
                { status: 'pending_search', trackTitle: 'S1' } as any
            ]);

            const result = await MechanicalRoyaltyService.isReleaseClearedForDistribution('r1');
            expect(result.cleared).toBe(false);
            expect(result.pendingTracks).toContain('S1');
        });
    });
});
