import { describe, it, expect, vi, beforeEach } from 'vitest';
import { musicLibraryService } from '../MusicLibraryService';
import { auth } from '@/services/firebase';
import { getDoc, setDoc, getDocs } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'user-123' }
    },
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    Timestamp: {
        now: () => ({ toISOString: () => new Date().toISOString() })
    }
}));

describe('MusicLibraryService', () => {
    const mockFeatures = {
        bpm: 125,
        key: 'A',
        scale: 'minor',
        energy: 0.75,
        duration: 180,
        danceability: 0.8,
        loudness: -12
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth state
        (auth as any).currentUser = { uid: 'user-123' };
    });

    it('should save analysis to Firestore', async () => {
        await musicLibraryService.saveAnalysis('track-1', 'test.mp3', mockFeatures, 'hash-123');

        expect(setDoc).toHaveBeenCalled();
        const callArgs = vi.mocked(setDoc).mock.calls[0];
        const data = callArgs[1] as any;

        expect(data.id).toBe('track-1');
        expect(data.filename).toBe('test.mp3');
        expect(data.features.bpm).toBe(125);
        expect(data.fileHash).toBe('hash-123');
    });

    it('should return null if user is not authenticated', async () => {
        (auth as any).currentUser = null;

        const result = await musicLibraryService.getAnalysis('track-1');
        expect(result).toBeNull();
        expect(getDoc).not.toHaveBeenCalled();
    });

    it('should retrieve cached analysis', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                id: 'track-1',
                features: mockFeatures
            })
        } as any);

        const result = await musicLibraryService.getAnalysis('track-1');

        expect(result).not.toBeNull();
        expect(result?.features.bpm).toBe(125);
        expect(getDoc).toHaveBeenCalled();
    });

    it('should return null on cache miss', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => false
        } as any);

        const result = await musicLibraryService.getAnalysis('track-not-found');
        expect(result).toBeNull();
    });

    it('should list library items', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [
                { data: () => ({ id: 'track-1', filename: 'one.mp3' }) },
                { data: () => ({ id: 'track-2', filename: 'two.mp3' }) }
            ]
        } as any);

        const items = await musicLibraryService.listLibrary();
        expect(items).toHaveLength(2);
        expect(items[0].filename).toBe('one.mp3');
    });
});
