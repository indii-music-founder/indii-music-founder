import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isrcService } from '../ISRCService';
import { FirestoreService } from '@/services/FirestoreService';
import { Timestamp } from 'firebase/firestore';

// Mock FirestoreService
vi.mock('@/services/FirestoreService', () => {
    return {
        FirestoreService: class {
            constructor(collectionName: string) { }
            list = vi.fn();
            add = vi.fn();
            where = vi.fn().mockImplementation((field, op, val) => ({ field, op, val }));
        }
    };
});

describe('ISRCService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should get ISRC record by ISRC string', async () => {
        const mockISRC = 'US-XXX-24-00001';
        const mockRecord = { id: '1', isrc: mockISRC, releaseId: 'rel-1' };

        // Mock the list method to return our record
        (isrcService as any).list.mockResolvedValue([mockRecord]);

        const result = await isrcService.getByIsrc(mockISRC);

        expect(result).toEqual(mockRecord);
        expect((isrcService as any).list).toHaveBeenCalledWith([
            expect.objectContaining({ field: 'isrc', val: mockISRC })
        ]);
    });

    it('should return null if ISRC record not found', async () => {
        (isrcService as any).list.mockResolvedValue([]);

        const result = await isrcService.getByIsrc('NON-EXISTENT');

        expect(result).toBeNull();
    });

    it('should get ISRC records by release ID', async () => {
        const mockReleaseId = 'rel-1';
        const mockRecords = [
            { id: '1', isrc: 'US-XXX-24-00001', releaseId: mockReleaseId },
            { id: '2', isrc: 'US-XXX-24-00002', releaseId: mockReleaseId }
        ];

        (isrcService as any).list.mockResolvedValue(mockRecords);

        const result = await isrcService.getByRelease(mockReleaseId);

        expect(result).toEqual(mockRecords);
        expect((isrcService as any).list).toHaveBeenCalledWith([
            expect.objectContaining({ field: 'releaseId', val: mockReleaseId })
        ]);
    });

    it('should record a new ISRC assignment', async () => {
        const mockData = {
            isrc: 'US-XXX-24-00001',
            releaseId: 'rel-1',
            userId: 'user-1',
            trackTitle: 'Test Track',
            artistName: 'Test Artist',
            assignedAt: Timestamp.now(),
            metadataSnapshot: {}
        };
        const mockId = 'new-record-id';

        (isrcService as any).add.mockResolvedValue(mockId);

        const result = await isrcService.recordAssignment(mockData);

        expect(result).toBe(mockId);
        expect((isrcService as any).add).toHaveBeenCalledWith(mockData);
    });
});
