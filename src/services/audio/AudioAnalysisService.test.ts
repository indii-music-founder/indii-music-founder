import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioAnalysisService } from './AudioAnalysisService';

// Polyfill Blob.arrayBuffer if missing (Node environment)
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = async function (this: Blob) {
        return new Response(this).arrayBuffer();
    };
}

// --- Mocks ---

const { mockTF, mockEssentiaInstance, mockEssentiaWASM } = vi.hoisted(() => ({
    mockTF: {
        loadGraphModel: vi.fn(),
        tensor: vi.fn(() => ({
            expandDims: vi.fn(() => ({
                dispose: vi.fn()
            })),
            dispose: vi.fn()
        }))
    },
    mockEssentiaInstance: {
        FrameGenerator: vi.fn(),
        Windowing: vi.fn(() => ({ frame: [] })),
        Spectrum: vi.fn(() => ({ spectrum: [] })),
        MelBands: vi.fn(() => ({ bands: { size: () => 0, get: () => 0 } })),
        RhythmExtractor2013: vi.fn(() => ({ bpm: 120 })),
        KeyExtractor: vi.fn(() => ({ key: 'C', scale: 'major' })),
        RMS: vi.fn(() => ({ rms: 0.5 })),
        Danceability: vi.fn(() => ({ danceability: 0.8 })),
        arrayToVector: vi.fn(),
        deleteVector: vi.fn(),
    },
    mockEssentiaWASM: vi.fn(() => Promise.resolve({
        FrameGenerator: vi.fn(),
        Windowing: vi.fn(() => ({ frame: [] })),
        Spectrum: vi.fn(() => ({ spectrum: [] })),
        MelBands: vi.fn(() => ({ bands: { size: () => 0, get: () => 0 } })),
        RhythmExtractor2013: vi.fn(() => ({ bpm: 120 })),
        KeyExtractor: vi.fn(() => ({ key: 'C', scale: 'major' })),
        RMS: vi.fn(() => ({ rms: 0.5 })),
        Danceability: vi.fn(() => ({ danceability: 0.8 })),
        arrayToVector: vi.fn(),
        deleteVector: vi.fn(),
    }))
}));

const MockEssentiaClass = vi.fn().mockImplementation(() => mockEssentiaInstance);

// Mock MusicLibraryService
vi.mock('@/services/music/MusicLibraryService', () => ({
    musicLibraryService: {
        getAnalysis: vi.fn(),
        saveAnalysis: vi.fn()
    }
}));

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('essentia.js', () => ({
    Essentia: class { constructor() { return mockEssentiaInstance; } },
    EssentiaWASM: mockEssentiaWASM,
    default: {
        Essentia: class { constructor() { return mockEssentiaInstance; } },
        EssentiaWASM: mockEssentiaWASM
    }
}));

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', () => mockTF);

// Mock Global Objects
global.fetch = vi.fn();
vi.stubGlobal('crypto', {
    subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    }
});

class MockAudioContext {
    decodeAudioData = vi.fn().mockResolvedValue({
        duration: 30,
        length: 44100 * 30,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn(() => new Float32Array(1000).fill(0.1))
    });
    close = vi.fn().mockResolvedValue(undefined);
}

class MockOfflineAudioContext {
    createBufferSource = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn()
    }));
    destination = {};
    startRendering = vi.fn().mockResolvedValue({
        getChannelData: vi.fn(() => new Float32Array(1000))
    });
}

global.AudioContext = MockAudioContext as any;
global.OfflineAudioContext = MockOfflineAudioContext as any;
(window as any).AudioContext = MockAudioContext;
(window as any).webkitAudioContext = MockAudioContext;

vi.mock('jszip', () => ({
    default: {
        loadAsync: vi.fn().mockResolvedValue({
            files: { 'model.json': {} },
            file: (name: string) => {
                if (name.endsWith('model.json')) {
                    return { async: vi.fn().mockResolvedValue(JSON.stringify({ weightsManifest: [{ paths: ['group1.bin'] }] })) };
                }
                return { async: vi.fn().mockResolvedValue(new Blob([])) };
            }
        })
    }
}));

import { musicLibraryService } from '@/services/music/MusicLibraryService';

describe('AudioAnalysisService', () => {
    let service: AudioAnalysisService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AudioAnalysisService();
    });

    it('should initialize Essentia correctly', async () => {
        const mockBuffer = {
            duration: 10,
            sampleRate: 44100,
            getChannelData: vi.fn(() => new Float32Array(1000).fill(0.1))
        } as unknown as AudioBuffer;

        await service.analyzeBuffer(mockBuffer);
        expect(mockEssentiaWASM).toHaveBeenCalled();
    });

    it('should return cached analysis if available', async () => {
        const mockFile = new File(['dummy content'], 'test.mp3', { type: 'audio/mpeg' });
        const cachedFeatures = { bpm: 125, key: 'A', scale: 'minor' };

        vi.mocked(musicLibraryService.getAnalysis).mockResolvedValueOnce({
            features: cachedFeatures
        } as any);

        const result = await service.analyze(mockFile);
        expect(result.fromCache).toBe(true);
        expect(result.features).toMatchObject(cachedFeatures);
    });

    it('should perform deep analysis on cache miss', async () => {
        const mockFile = new File(['dummy content'], 'new_track.wav', { type: 'audio/wav' });
        vi.mocked(musicLibraryService.getAnalysis).mockResolvedValueOnce(null);

        const mockModel = {
            predict: vi.fn(() => ({
                mean: vi.fn(() => ({ data: vi.fn().mockResolvedValue([0.1, 0.9]) })),
                dispose: vi.fn()
            })),
            dispose: vi.fn()
        };
        vi.mocked(mockTF.loadGraphModel).mockResolvedValue(mockModel as any);
        (global.fetch as any).mockResolvedValue({ blob: vi.fn().mockResolvedValue(new Blob([])) });

        const result = await service.analyze(mockFile);
        expect(result.fromCache).toBe(false);
        expect(result.features.bpm).toBe(120);
    });

    it('should handle analysis errors gracefully', async () => {
        const mockFile = new File(['corrupt'], 'bad.wav', { type: 'audio/wav' });
        const mockCtx = new MockAudioContext();
        mockCtx.decodeAudioData = vi.fn().mockRejectedValue(new Error('Decode failed'));
        global.AudioContext = function () { return mockCtx; } as any;

        await expect(service.analyzeDeep(mockFile)).rejects.toThrow('Decode failed');
    });
});
