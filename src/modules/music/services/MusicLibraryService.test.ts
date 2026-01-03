import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicLibraryService } from './MusicLibraryService';
import { auth } from '@/services/firebase';
import { setDoc, getDoc, getDocs } from 'firebase/firestore';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user-uid' } },
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn().mockImplementation(() => ({ id: 'mock-doc' })),
    setDoc: vi.fn().mockResolvedValue({}),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn().mockReturnValue('mock-timestamp')
}));

describe('MusicLibraryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should save track analysis if user is authenticated', async () => {
        const mockFile = {
            name: 'test.mp3',
            size: 1000,
            lastModified: 123456789
        } as any;

        const mockFeatures = { bpm: 120, key: 'C', scale: 'major', energy: 0.8, duration: 180 };

        await MusicLibraryService.saveTrackAnalysis(mockFile, mockFeatures as any, 'fingerprint-123');

        expect(setDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                fileName: 'test.mp3',
                features: mockFeatures,
                fingerprint: 'fingerprint-123'
            }),
            { merge: true }
        );
    });

    it('should NOT save track analysis if user is NOT authenticated', async () => {
        const originalUser = auth.currentUser;
        (auth as any).currentUser = null;

        const mockFile = { name: 'test.mp3' } as any;
        const mockFeatures = { bpm: 120, key: 'C', scale: 'major', energy: 0.8, duration: 180 };

        await MusicLibraryService.saveTrackAnalysis(mockFile, mockFeatures as any);

        expect(setDoc).not.toHaveBeenCalled();

        (auth as any).currentUser = originalUser;
    });

    it('should load track analysis if it exists', async () => {
        const mockFile = {
            name: 'test.mp3',
            size: 1000,
            lastModified: 123456789
        } as any;

        const mockData = { features: { bpm: 120 }, fingerprint: 'fp' };
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => mockData
        } as any);

        const result = await MusicLibraryService.getTrackAnalysis(mockFile);

        expect(result).toEqual(mockData);
    });
});
