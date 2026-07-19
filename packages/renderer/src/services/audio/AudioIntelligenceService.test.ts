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

import { AudioIntelligenceService } from './AudioIntelligenceService';

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

    it('never sends a browser master to Gemini as inline base64', async () => {
        const file = new File(['small audio bytes'], 'track.wav', { type: 'audio/wav' });
        await expect(service.analyze(file)).rejects.toThrow(/will not upload raw master bytes to Gemini/);

        // Technical QC is allowed to run locally, but neither Gemini request
        // may receive the full browser master.
        expect(mockAudioAnalyze).toHaveBeenCalledWith(file);
        expect(mockGenerateStructuredData).not.toHaveBeenCalled();
        expect(mockMapEmotionalArcWithProxy).not.toHaveBeenCalled();
        expect(mockMapEmotionalArc).not.toHaveBeenCalled();
    });
});
