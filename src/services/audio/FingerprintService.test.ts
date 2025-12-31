import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FingerprintService } from './FingerprintService';
import { audioAnalysisService } from './AudioAnalysisService';

// Mock dependencies
vi.mock('./AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyze: vi.fn()
    }
}));

// Mock crypto
const mockCrypto = {
    subtle: {
        digest: vi.fn(),
    },
};
Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
});

// Mock URL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('FingerprintService', () => {
    let service: FingerprintService;
    let mockFile: File;

    beforeEach(() => {
        service = new FingerprintService();
        mockFile = new File(['mock audio data'], 'test.mp3', { type: 'audio/mpeg' });
        Object.defineProperty(mockFile, 'arrayBuffer', {
            value: vi.fn().mockResolvedValue(new ArrayBuffer(32))
        });

        // Reset mocks
        vi.clearAllMocks();

        // Mock SHA-256 digest
        (mockCrypto.subtle.digest as any).mockResolvedValue(new ArrayBuffer(32));

        // Mock getDuration via prototype spike or specialized mock if private
        // Since getDuration is private, we test observable behaviors
    });

    it('should generate a fingerprint successfully', async () => {
        // Mock feature extraction
        (audioAnalysisService.analyze as any).mockResolvedValue({
            bpm: 120,
            key: 'C',
            scale: 'Major',
            energy: 0.8,
            duration: 180
        });

        const fingerprint = await service.generateFingerprint(mockFile);

        expect(fingerprint).toContain('SONIC-');
        expect(fingerprint).toContain('120BPM');
        expect(fingerprint).toContain('CMajor');
    });

    it('should use existing duration if provided (optimization check)', async () => {
        const existingFeatures = {
            bpm: 128,
            key: 'A',
            scale: 'Minor',
            energy: 0.9,
            danceability: 0.8,
            loudness: -5,
            duration: 200 // Pre-calculated
        };

        // Spy on URL.createObjectURL to detect if getDuration was called
        // getDuration calls createObjectURL, so if it's NOT called, optimization worked
        const createURLSpy = vi.spyOn(URL, 'createObjectURL');

        const fingerprint = await service.generateFingerprint(mockFile, existingFeatures);

        expect(fingerprint).toContain('200s'); // Should use the 200 from existingFeatures
        expect(createURLSpy).not.toHaveBeenCalled(); // CORE VERIFICATION: DOM not touched
    });

    it('should fallback to calculating duration if NOT provided', async () => {
        const existingFeatures = {
            bpm: 128,
            key: 'A',
            scale: 'Minor',
            energy: 0.9,
            // No duration here
        };

        // We need to mock the internal getDuration logic for this to work in JSDOM/Node
        // Since getDuration creates an Audio element, we mock createElement
        const mockAudio = {
            duration: 150,
            onloadedmetadata: null as any,
            onerror: null as any,
            set src(v: string) {
                // Simulate async load
                setTimeout(() => {
                    if (this.onloadedmetadata) this.onloadedmetadata();
                }, 10);
            }
        };

        vi.spyOn(document, 'createElement').mockReturnValue(mockAudio as any);

        const fingerprint = await service.generateFingerprint(mockFile, existingFeatures as any);

        expect(fingerprint).toContain('150s');
    });

    it('should handle errors gracefully', async () => {
        (mockCrypto.subtle.digest as any).mockRejectedValue(new Error('Crypto failed'));

        const fingerprint = await service.generateFingerprint(mockFile);

        expect(fingerprint).toBeNull();
    });
});
