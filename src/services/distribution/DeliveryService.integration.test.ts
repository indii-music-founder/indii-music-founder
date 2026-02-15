import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeliveryService } from './DeliveryService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import path from 'path';

// Mocks
const mockFs = {
    existsSync: vi.fn(),
    promises: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
    }
};

vi.mock('fs', () => ({
    default: mockFs,
    ...mockFs
}));

vi.mock('@/services/ddex/ERNService', () => ({
    ernService: {
        generateERN: vi.fn().mockResolvedValue({ success: true, xml: '<ERN>Mock XML</ERN>' }),
        parseERN: vi.fn().mockResolvedValue({ success: true, data: {} }),
        validateERNContent: vi.fn().mockReturnValue({ valid: true, errors: [] })
    }
}));

const mockMetadata: ExtendedGoldenMetadata = {
    trackTitle: 'Test Track',
    artistName: 'Test Artist',
    isrc: 'USTEST12345',
    explicit: false,
    genre: 'Pop',
    labelName: 'Test Label',
    dpid: 'PADPIDA001',
    splits: [],
    pro: 'None',
    publisher: 'Self',
    containsSamples: false,
    isGolden: true,
    releaseType: 'Single',
    releaseDate: '2025-01-01',
    territories: ['Worldwide'],
    distributionChannels: ['streaming'],
    aiGeneratedContent: {
        isFullyAIGenerated: false,
        isPartiallyAIGenerated: false
    }
};

describe('DeliveryService Integration', () => {
    let deliveryService: DeliveryService;

    beforeEach(() => {
        vi.clearAllMocks();
        deliveryService = new DeliveryService();
        mockFs.existsSync.mockReturnValue(true); // Default files exist
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should generate release package with XML only if no assets provided', async () => {
        const outputDir = '/tmp/test-output';
        const result = await deliveryService.generateReleasePackage(mockMetadata, outputDir);

        expect(result.success).toBe(true);
        expect(result.xml).toBe('<ERN>Mock XML</ERN>');

        // Check file writes
        expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
            path.join(outputDir, 'ern.xml'),
            '<ERN>Mock XML</ERN>',
            'utf8'
        );
        expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
    });

    it('should copy assets when provided', async () => {
        const outputDir = '/tmp/test-output';
        const assets = {
            audioFiles: [{
                url: '/source/audio.wav',
                format: 'wav' as any,
                sizeBytes: 1000,
                mimeType: 'audio/wav',
                sampleRate: 44100,
                bitDepth: 16
            }],
            coverArt: {
                url: '/source/cover.jpg',
                width: 3000,
                height: 3000,
                mimeType: 'image/jpeg',
                sizeBytes: 2000
            }
        };

        const result = await deliveryService.generateReleasePackage(mockMetadata, outputDir, assets);

        expect(result.success).toBe(true);

        // Check XML write
        expect(mockFs.promises.writeFile).toHaveBeenCalled();

        // Check Asset Copies
        const resourcesDir = path.join(outputDir, 'resources');

        // Audio Copy
        expect(mockFs.promises.copyFile).toHaveBeenCalledWith(
            assets.audioFiles[0].url,
            path.join(resourcesDir, 'A1.wav')
        );

        // Cover Copy
        expect(mockFs.promises.copyFile).toHaveBeenCalledWith(
            assets.coverArt.url,
            path.join(resourcesDir, 'IMG2.jpg')
        );
    });

    it('should handle missing asset source files gracefully (warn but proceed)', async () => {
        const outputDir = '/tmp/test-output';
        const assets = {
            audioFiles: [{
                url: '/missing/audio.wav',
                format: 'wav' as any,
                sizeBytes: 1000,
                mimeType: 'audio/wav',
                sampleRate: 44100,
                bitDepth: 16
            }],
            coverArt: {
                url: '/source/cover.jpg',
                width: 3000,
                height: 3000,
                mimeType: 'image/jpeg',
                sizeBytes: 2000
            }
        };

        // Mock existsSync to return false for audio
        mockFs.existsSync.mockImplementation((pathStr: string) => {
            if (pathStr === '/missing/audio.wav') return false;
            return true;
        });

        const result = await deliveryService.generateReleasePackage(mockMetadata, outputDir, assets);

        expect(result.success).toBe(true);

        // Should not copy audio
        expect(mockFs.promises.copyFile).not.toHaveBeenCalledWith(
            assets.audioFiles[0].url,
            expect.anything()
        );

        // Should copy cover
        expect(mockFs.promises.copyFile).toHaveBeenCalledWith(
            assets.coverArt.url,
            expect.anything()
        );
    });
});
