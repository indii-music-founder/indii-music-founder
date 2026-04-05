import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isrcService } from '../ISRCService';
import { getDocs, addDoc, Timestamp } from 'firebase/firestore';

describe('ISRCService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should get ISRC record by ISRC string', async () => {
        const mockISRC = 'US-XXX-24-00001';
        const mockRecord = { isrc: mockISRC, releaseId: 'rel-1' };

        (getDocs as import("vitest").Mock).mockResolvedValueOnce({
            empty: false,
            docs: [{ id: '1', data: () => mockRecord }]
        });

        const result = await isrcService.getByIsrc(mockISRC);

        expect(result).toEqual({ id: '1', ...mockRecord });
        expect(getDocs).toHaveBeenCalled();
    });

    it('should return null if ISRC record not found', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            empty: true,
            docs: []
        } as unknown as Awaited<ReturnType<typeof getDocs>>);

        const result = await isrcService.getByIsrc('NON-EXISTENT');

        expect(result).toBeNull();
    });

    it('should get ISRC records by release ID', async () => {
        const mockReleaseId = 'rel-1';
        const mockRecords = [
            { isrc: 'US-XXX-24-00001', releaseId: mockReleaseId },
            { isrc: 'US-XXX-24-00002', releaseId: mockReleaseId }
        ];

        (getDocs as import("vitest").Mock).mockResolvedValueOnce({
            empty: false,
            docs: mockRecords.map((data, i) => ({ id: String(i + 1), data: () => data }))
        });

        const result = await isrcService.getByRelease(mockReleaseId);

        expect(result).toEqual([
            { id: '1', ...mockRecords[0] },
            { id: '2', ...mockRecords[1] }
        ]);
        expect(getDocs).toHaveBeenCalled();
    });

    it('should record a new ISRC assignment', async () => {
        const mockData = {
            isrc: 'US-XXX-24-00001',
            releaseId: 'rel-1',
            userId: 'user-1',
            trackTitle: 'Test Track',
            artistName: 'Test Artist',
            status: 'assigned' as const,
            assignedAt: Timestamp.now(),
            metadataSnapshot: {}
        };
        const mockId = 'new-record-id';

        vi.mocked(addDoc).mockResolvedValueOnce({ id: mockId } as unknown as Awaited<ReturnType<typeof addDoc>>);

        const result = await isrcService.recordAssignment(mockData);

        expect(result).toBe(mockId);
        expect(addDoc).toHaveBeenCalledWith(expect.anything(), mockData);
    });
});
