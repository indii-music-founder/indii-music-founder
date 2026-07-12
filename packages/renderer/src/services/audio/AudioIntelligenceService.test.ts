import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    mockGenerateStructuredData,
    mockAudioAnalyze,
    mockGenerateFingerprint,
    mockGetAnalysisByHash,
    mockSaveAnalysis,
    mockMapEmotionalArc,
    mockMapEmotionalArcWithProxy,
} = vi.hoisted(() => ({
    mockGenerateStructuredData: vi.fn(),
    mockAudioAnalyze: vi.fn(),
    mockGenerateFingerprint: vi.fn(async () => 'hash-abc123'),
    mockGetAnalysisByHash: vi.fn(async () => null),
    mockSaveAnalysis: vi.fn(async () => undefined),
    mockMapEmotionalArc: vi.fn(),
    mockMapEmotionalArcWithProxy: vi.fn(async () => ({
        arc: [],
        soulPeakIndex: 0,
        trajectoryShape: 'Plateau' as const,
        emotionalSignature: 'test',
        tensionRatio: 0.5,
    })),
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateStructuredData: mockGenerateStructuredData },
}));

vi.mock('./AudioAnalysisService', () => ({
    audioAnalysisService: { analyze: mockAudioAnalyze },
}));

vi.mock('./FingerprintService', () => ({
    fingerprintService: { generateFingerprint: mockGenerateFingerprint },
}));

vi.mock('@/services/music/MusicLibraryService', () => ({
    musicLibraryService: {
        getAnalysisByHash: mockGetAnalysisByHash,
        saveAnalysis: mockSaveAnalysis,
    },
}));

vi.mock('./EnergyMapService', () => ({
    energyMapService: {
        mapEmotionalArc: mockMapEmotionalArc,
        mapEmotionalArcWithProxy: mockMapEmotionalArcWithProxy,
    },
}));

vi.mock('@/services/marketing/AutoCopywriter', () => ({
    autoCopywriter: { generateCopyPackage: vi.fn(async () => undefined) },
}));

vi.mock('./StyleMemoryStore', () => ({
    styleMemoryStore: {
        compareToDiscography: vi.fn(async () => null),
        recordTrack: vi.fn(async () => undefined),
    },
}));

vi.mock('@/services/licensing/SyncMetadataTaggingService', () => ({
    syncMetadataTaggingService: { syncTagsByFingerprint: vi.fn(async () => undefined) },
}));

vi.mock('@/services/intelligence/NeuralCortexService', () => ({
    neuralCortex: { ingest: vi.fn(async () => undefined) },
}));

import { AudioIntelligenceService, MAX_BROWSER_ANALYSIS_BYTES } from './AudioIntelligenceService';

const TECHNICAL_FEATURES = {
    bpm: 120,
    key: 'C',
    scale: 'major',
    energy: 0.7,
    duration: 180,
    danceability: 0.6,
    loudness: -10,
};

const SEMANTIC_DATA = {
    mood: ['Energetic'],
    genre: ['House'],
    instruments: ['Synth'],
    ddexGenre: 'Electronic',
    ddexSubGenre: 'House',
    language: 'eng',
    isExplicit: false,
    marketingComment: 'test',
    timbre: { texture: 'a', brightness: 'b', saturation: 'c', spaceDepth: 'd' },
    productionValue: { era: 'a', quality: 'b', mixBalance: 'c', aiArtifacts: false },
    visualImagery: { abstract: 'a', narrative: 'b', lighting: 'c' },
    marketingHooks: { keywords: [], oneLiner: 'x' },
    targetPrompts: { image: 'a', veo: 'b' },
};

describe('AudioIntelligenceService (ISSUE-962)', () => {
    let service: AudioIntelligenceService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AudioIntelligenceService();
        mockAudioAnalyze.mockResolvedValue({ features: TECHNICAL_FEATURES, proxyBase64: undefined });
        mockGenerateStructuredData.mockResolvedValue(SEMANTIC_DATA);
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('rejects a master over the browser analysis size limit before any encoding/upload work happens', async () => {
        const oversized = new File(['x'], 'huge.wav', { type: 'audio/wav' });
        Object.defineProperty(oversized, 'size', { value: MAX_BROWSER_ANALYSIS_BYTES + 1 });

        await expect(service.analyze(oversized)).rejects.toThrow(/too large for browser-based deep analysis/);

        expect(mockGenerateStructuredData).not.toHaveBeenCalled();
        expect(mockMapEmotionalArcWithProxy).not.toHaveBeenCalled();
        expect(mockMapEmotionalArc).not.toHaveBeenCalled();
    });

    it('encodes the master to base64 exactly once and shares it between semantic and energy-map analysis', async () => {
        const file = new File(['small audio bytes'], 'track.wav', { type: 'audio/wav' });
        const fileToBase64Spy = vi.spyOn(AudioIntelligenceService.prototype as any, 'fileToBase64');

        await service.analyze(file);

        expect(fileToBase64Spy).toHaveBeenCalledTimes(1);

        // The Gemini semantic call and the energy-map call must receive the
        // SAME base64 payload produced by that single encode — never two
        // independently-encoded copies of the full master.
        const semanticCallArgs = mockGenerateStructuredData.mock.calls[0] as any;
        const semanticInlineData = semanticCallArgs[0][1].inlineData.data;
        const energyMapCallArgs = mockMapEmotionalArcWithProxy.mock.calls[0] as any;
        const energyMapBase64 = energyMapCallArgs[0];
        expect(mockMapEmotionalArc).not.toHaveBeenCalled();
        expect(energyMapBase64).toBe(semanticInlineData);
        expect(typeof semanticInlineData).toBe('string');
        expect(semanticInlineData.length).toBeGreaterThan(0);
    });

    it('allows a master exactly at the size limit', async () => {
        const file = new File(['x'], 'at-limit.wav', { type: 'audio/wav' });
        Object.defineProperty(file, 'size', { value: MAX_BROWSER_ANALYSIS_BYTES });

        await expect(service.analyze(file)).resolves.toBeDefined();
    });
});
