import { describe, it, expect, vi, beforeEach } from 'vitest';
import { musicLibraryService } from '../MusicLibraryService';
import { auth } from '@/services/firebase';
import { getDoc, setDoc, getDocs } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: {
        currentUser: { uid: 'user-123' }
    },
    db: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    Timestamp: {
        now: () => ({
            serverTimestamp: vi.fn(), toISOString: () => new Date().toISOString()
        })
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
        Object.assign(auth, { currentUser: { uid: 'user-123' } });
    });

    it('should save analysis to Firestore', async () => {
        await musicLibraryService.saveAnalysis('track-1', 'test.mp3', mockFeatures, 'hash-123');

        expect(setDoc).toHaveBeenCalled();
        const callArgs = vi.mocked(setDoc).mock.calls[0];
        const data = callArgs![1] as Record<string, unknown>;

        expect(data.id).toBe('track-1');
        expect(data.filename).toBe('test.mp3');
        expect((data.features as Record<string, unknown>).bpm).toBe(125);
        expect(data.fileHash).toBe('hash-123');
    });

    it('should return null if user is not authenticated', async () => {
        Object.assign(auth, { currentUser: null });

        const result = await musicLibraryService.getAnalysis('track-1');
        expect(result).toBeNull();
        expect(getDoc).not.toHaveBeenCalled();
    });

    it('should retrieve cached analysis', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                serverTimestamp: vi.fn(),
                id: 'track-1',
                features: mockFeatures
            })
        } as unknown as import('firebase/firestore').DocumentSnapshot);

        const result = await musicLibraryService.getAnalysis('track-1');

        expect(result).not.toBeNull();
        expect(result?.features.bpm).toBe(125);
        expect(getDoc).toHaveBeenCalled();
    });

    it('should return null on cache miss', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => false
        } as unknown as import('firebase/firestore').DocumentSnapshot);

        const result = await musicLibraryService.getAnalysis('track-not-found');
        expect(result).toBeNull();
    });

    it('should list library items', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [
                {
                    data: () => ({
                        serverTimestamp: vi.fn(), id: 'track-1', filename: 'one.mp3'
                    })
                },
                {
                    data: () => ({
                        serverTimestamp: vi.fn(), id: 'track-2', filename: 'two.mp3'
                    })
                }
            ]
        } as unknown as import('firebase/firestore').QuerySnapshot);

        const items = await musicLibraryService.listLibrary();
        expect(items).toHaveLength(2);
        expect(items[0]!.filename).toBe('one.mp3');
    });
});
