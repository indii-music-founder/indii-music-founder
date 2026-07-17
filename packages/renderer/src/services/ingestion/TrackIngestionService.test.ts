import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackIngestionService } from './TrackIngestionService';
import { fingerprintService } from '@/services/audio/FingerprintService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import { masterAudioService } from '@/services/audio/MasterAudioService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

// Mock dependencies
vi.mock('@/services/audio/FingerprintService');
vi.mock('@/services/audio/AudioIntelligenceService');
vi.mock('@/services/metadata/TrackLibraryService');
vi.mock('@/services/audio/MasterAudioService');
vi.mock('@/services/firebase', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/services/firebase')>(),
    auth: { currentUser: { uid: 'owner-1' } }
}));

describe('TrackIngestionService', () => {
    let service: TrackIngestionService;

    beforeEach(() => {
        service = new TrackIngestionService();
        vi.clearAllMocks();
    });

    const mockFile = new File(['test audio data'], 'test-song.mp3', { type: 'audio/mp3' });
    const mockFingerprint = 'SONIC-TEST-12345';
    const mockMasterAsset = {
        audioProperties: {
            bitDepth: 24,
            channels: 2,
            codec: 'PCM' as const,
            container: 'wav' as const,
            sampleRate: 48_000,
        },
        contentHash: 'a'.repeat(64),
        downloadUrl: 'https://storage.example/master.mp3',
        masterFingerprint: mockFingerprint,
        mimeType: 'audio/mp3',
        originalFileName: 'test-song.mp3',
        sizeBytes: mockFile.size,
        storagePath: `masters/owner-1/${'a'.repeat(64)}/original.mp3`,
        uploadedAt: '2026-07-17T18:00:00.000Z',
    };

    const mockProfile = {
        id: mockFingerprint,
        technical: {
            bpm: 120,
            key: 'C',
            scale: 'major',
            energy: 0.8,
            duration: 180,
            danceability: 0.9,
            loudness: -5,
            audit: {
                peakLevel: -0.8,
                truePeakDb: -1,
                integratedLoudness: -14,
                sampleRate: 48000,
                isStereo: true,
                rejectionRisks: [],
            },
        },
        semantic: {
            mood: ['Energetic', 'Happy'],
            genre: ['Pop'],
            instruments: ['Synth', 'Drums'],
            ddexGenre: 'Pop',
            ddexSubGenre: 'Dance Pop',
            language: 'eng',
            isExplicit: false,
            marketingComment: 'Best song ever',
            timbre: {
                texture: 'Glassy & Clean',
                brightness: 'Crisp & Airy',
                saturation: 'Lightly Compressed',
                spaceDepth: 'Wide Stereo Field'
            },
            productionValue: {
                era: 'Modern Pop',
                quality: 'Professional Studio',
                mixBalance: 'Balanced',
                aiArtifacts: false
            },
            visualImagery: {
                abstract: 'Colorful swirls',
                narrative: 'A dance party',
                lighting: 'Neon'
            },
            marketingHooks: {
                keywords: ['dance', 'party'],
                oneLiner: 'Best song ever'
            },
            targetPrompts: {
                image: 'visual prompt',
                veo: 'video prompt'
            }
        },
        analyzedAt: 123456789,
        modelVersion: 'gemini-3-test'
    };

    it('should skip analysis if track already exists (Idempotency)', async () => {
        // Setup Mocks
        vi.mocked(fingerprintService.generateFingerprint).mockResolvedValue(mockFingerprint);
        vi.mocked(masterAudioService.persist).mockResolvedValue(mockMasterAsset);

        const existingMetadata = {
            trackTitle: 'Existing Track',
            masterFingerprint: mockFingerprint
        } as ExtendedGoldenMetadata;

        vi.mocked(trackLibrary.getByFingerprint).mockResolvedValue(existingMetadata);

        // Execute
        const result = await service.ingestTrack(mockFile);

        // Verify
        expect(fingerprintService.generateFingerprint).toHaveBeenCalledWith(mockFile);
        expect(masterAudioService.persist).toHaveBeenCalledWith(mockFile, {
            userId: 'owner-1',
            masterFingerprint: mockFingerprint,
        });
        expect(trackLibrary.getByFingerprint).toHaveBeenCalledWith(mockFingerprint);
        expect(audioIntelligence.analyze).not.toHaveBeenCalled(); // Crucial check
        expect(result).toEqual({
            ...existingMetadata,
            userId: 'owner-1',
            masterAsset: mockMasterAsset,
        });
        expect(trackLibrary.saveTrack).toHaveBeenCalledWith(result);
    });

    it('should perform full analysis and save if track is new', async () => {
        // Setup Mocks
        vi.mocked(fingerprintService.generateFingerprint).mockResolvedValue(mockFingerprint);
        vi.mocked(masterAudioService.persist).mockResolvedValue(mockMasterAsset);
        vi.mocked(trackLibrary.getByFingerprint).mockResolvedValue(null); // Not found
        vi.mocked(audioIntelligence.analyze).mockResolvedValue(mockProfile);

        // Execute
        const result = await service.ingestTrack(mockFile);

        // Verify
        expect(fingerprintService.generateFingerprint).toHaveBeenCalledWith(mockFile);
        expect(trackLibrary.getByFingerprint).toHaveBeenCalledWith(mockFingerprint);
        expect(audioIntelligence.analyze).toHaveBeenCalledWith(mockFile);

        // Check Metadata Mapping
        expect(result.masterFingerprint).toBe(mockFingerprint);
        expect(result.userId).toBe('owner-1');
        expect(result.masterAsset).toEqual(mockMasterAsset);
        expect(result.trackTitle).toBe('test-song');
        expect(result.durationSeconds).toBe(180);
        expect(result.audioTechnical).toEqual(mockMasterAsset.audioProperties);
        expect(result.genre).toBe('Pop'); // From ddexGenre
        expect(result.language).toBe('eng');
        expect(result.explicit).toBe(false);

        // Verify Save
        expect(trackLibrary.saveTrack).toHaveBeenCalledWith(result);
    });

    it('should throw error if fingerprinting fails', async () => {
        vi.mocked(fingerprintService.generateFingerprint).mockResolvedValue(null);
        await expect(service.ingestTrack(mockFile)).rejects.toThrow('Failed to fingerprint');
    });
});
