
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MusicTools } from '../MusicTools';

describe('MusicTools', () => {
    const originalElectronAPI = window.electronAPI;

    beforeEach(() => {
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
        // Restore

        window.electronAPI = originalElectronAPI;
    });

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
});
