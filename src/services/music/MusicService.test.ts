
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicService } from './MusicService';
import { useStore } from '@/core/store';
import { TrackStatus } from '@/modules/music/types';

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-track-id' })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    Timestamp: { now: vi.fn() }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

describe('MusicService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStore.getState as any).mockReturnValue({
            userProfile: { id: 'test-user-id' }
        });
    });

    it('should add a new track', async () => {
        const trackData = {
            title: 'New Demo',
            artist: 'Me',
            version: '1.0',
            tags: [],
            status: TrackStatus.DEMO
        };

        const id = await MusicService.addTrack(trackData);
        expect(id).toBe('mock-track-id');
    });

    it('should create a playlist', async () => {
        const playlistData = {
            name: 'My Hits',
            tracks: []
        };
        const id = await MusicService.createPlaylist(playlistData);
        expect(id).toBe('mock-track-id'); // Reusing mock ID for simplicity
    });
});
