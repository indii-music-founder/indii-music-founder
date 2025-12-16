import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioAnalysisEngine } from './AudioAnalysisEngine';

describe('AudioAnalysisEngine', () => {
    let engine: AudioAnalysisEngine;
    let mockDecodeAudioData: any;

    beforeEach(() => {
        // Mock AudioBuffer
        const mockAudioBuffer = {
            length: 44100 * 10, // 10 seconds
            sampleRate: 44100,
            duration: 10,
            numberOfChannels: 2,
            getChannelData: vi.fn().mockReturnValue(new Float32Array(44100 * 10).fill(0.1)) // Dummy data
        };

        // Mock decodeAudioData
        mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer);

        // Mock AudioContext
        const MockAudioContext = vi.fn().mockImplementation(function () {
            return {
                decodeAudioData: mockDecodeAudioData,
            };
        });

        vi.stubGlobal('AudioContext', MockAudioContext);

        // Safely add to window if it exists (it should in jsdom)
        if (typeof window !== 'undefined') {
            Object.defineProperty(window, 'AudioContext', {
                writable: true,
                value: MockAudioContext
            });
            Object.defineProperty(window, 'webkitAudioContext', {
                writable: true,
                value: MockAudioContext
            });
        }

        engine = new AudioAnalysisEngine();
    });

    it('should analyze audio from ArrayBuffer', async () => {
        const dummyBuffer = new ArrayBuffer(8);
        const result = await engine.analyze(dummyBuffer);

        expect(mockDecodeAudioData).toHaveBeenCalledWith(dummyBuffer);
        expect(result).toHaveProperty('bpm');
        expect(result).toHaveProperty('key');
        expect(result).toHaveProperty('energy');
        expect(result).toHaveProperty('brightness');
        expect(result).toHaveProperty('duration', 10);
    });

    it('should calculate reasonable metrics for silence/low energy', async () => {
        // Override getChannelData to return silence
        const mockAudioBuffer = {
            length: 44100,
            sampleRate: 44100,
            duration: 1,
            numberOfChannels: 1,
            getChannelData: vi.fn().mockReturnValue(new Float32Array(44100).fill(0))
        };
        mockDecodeAudioData.mockResolvedValue(mockAudioBuffer);

        const result = await engine.analyze(new ArrayBuffer(8));

        expect(result.energy).toBe(0);
        expect(result.brightness).toBe(0);
    });

    it('should handle File input', async () => {
        const file = new File([""], "test.mp3");
        // @ts-expect-error File polyfill lacks arrayBuffer typing in jsdom
        file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

        await engine.analyze(file);
        expect(file.arrayBuffer).toHaveBeenCalled();
    });
});
