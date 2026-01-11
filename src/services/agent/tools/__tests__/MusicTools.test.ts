
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MusicTools } from '../MusicTools';

// Mock mocks
const mockAddTrack = vi.fn();
const mockCreatePlaylist = vi.fn();

// Mock dependencies
vi.mock('@/services/music/MusicService', () => ({
    MusicService: {
        addTrack: (...args: any[]) => mockAddTrack(...args),
        createPlaylist: (...args: any[]) => mockCreatePlaylist(...args)
    }
}));

vi.mock('@/modules/music/types', () => ({
    TrackStatus: {
        DEMO: 'demo'
    }
}));

const mockGetState = vi.fn(() => ({
    userProfile: { displayName: 'Test Artist' }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MusicTools', () => {
    const originalElectronAPI = window.electronAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset state mock default
        mockGetState.mockReturnValue({
            userProfile: { displayName: 'Test Artist' }
        });

        // Mock default window.electronAPI
        // @ts-expect-error electron preload injects electronAPI for audio tools
        window.electronAPI = {
            audio: {
                analyze: vi.fn(),
                getMetadata: vi.fn()
            }
        };
    });

    afterEach(() => {
        window.electronAPI = originalElectronAPI;
    });

    // Existing tests...
    it('analyze_audio returns error if electron API is missing', async () => {
        window.electronAPI = undefined;
        const result = await MusicTools.analyze_audio({ filePath: '/test/audio.mp3' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Audio Engine not available via Electron API.');
    });

    it('analyze_audio calls electronAPI.audio.analyze', async () => {
        const mockAnalyze = vi.fn().mockResolvedValue({ bpm: 120, key: 'C Major' });
        window.electronAPI!.audio.analyze = mockAnalyze;

        const result = await MusicTools.analyze_audio({ filePath: '/test/audio.mp3' });

        expect(mockAnalyze).toHaveBeenCalledWith('/test/audio.mp3');
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ bpm: 120, key: 'C Major' });
    });

    it('get_audio_metadata calls electronAPI.audio.getMetadata', async () => {
        const mockGetMetadata = vi.fn().mockResolvedValue({ title: 'Test Song', artist: 'Test Artist' });
        (global as any).window = {
            electronAPI: {
                audio: { getMetadata: mockGetMetadata }
            }
        };

        const result = await MusicTools.get_audio_metadata({ hash: 'abc-123' });

        expect(mockGetMetadata).toHaveBeenCalledWith('abc-123');
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ title: 'Test Song', artist: 'Test Artist' });
    });

    // New tests
    describe('save_track_idea', () => {
        it('should save track idea with valid inputs', async () => {
            mockAddTrack.mockResolvedValue('track-123');
            const args = { title: 'My New Song', notes: 'Needs more cowbell' };

            const result = await MusicTools.save_track_idea(args);

            expect(mockAddTrack).toHaveBeenCalledWith({
                title: 'My New Song',
                artist: 'Test Artist',
                version: '1.0',
                tags: [],
                metadata: { notes: 'Needs more cowbell' },
                status: 'demo'
            });
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 'track-123', title: 'My New Song' });
        });

        it('should handle empty notes', async () => {
            mockAddTrack.mockResolvedValue('track-456');
            const args = { title: 'Instrumental' };

            const result = await MusicTools.save_track_idea(args);

            expect(mockAddTrack).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Instrumental',
                metadata: { notes: '' }
            }));
            expect(result.success).toBe(true);
        });

        it('should use default artist name "Me" if userProfile is missing', async () => {
            mockGetState.mockReturnValue({ userProfile: null });
            mockAddTrack.mockResolvedValue('track-789');
            const args = { title: 'Mystery Track' };

            await MusicTools.save_track_idea(args);

            expect(mockAddTrack).toHaveBeenCalledWith(expect.objectContaining({
                artist: 'Me'
            }));
        });
    });

    describe('create_playlist', () => {
        it('should create playlist with valid inputs', async () => {
            mockCreatePlaylist.mockResolvedValue('playlist-123');
            const args = { name: 'Gym Mix', description: 'Pump it up' };

            const result = await MusicTools.create_playlist(args);

            expect(mockCreatePlaylist).toHaveBeenCalledWith({
                name: 'Gym Mix',
                description: 'Pump it up',
                tracks: []
            });
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 'playlist-123', name: 'Gym Mix' });
        });

        it('should handle empty description', async () => {
             mockCreatePlaylist.mockResolvedValue('playlist-456');
            const args = { name: 'Chill' };

            const result = await MusicTools.create_playlist(args);

            expect(mockCreatePlaylist).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Chill',
                description: ''
            }));
            expect(result.success).toBe(true);
        });
    });
});
