
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtendedGoldenMetadata, ReleaseAssets } from '@/services/distribution/types/distributor';

// Mock dependencies before importing service
vi.mock('@/services/security/CredentialService', () => ({
  credentialService: {
    getCredentials: vi.fn().mockResolvedValue({ username: 'user', password: 'pass' })
  }
}));

// Mock fs globally
const mockFs = {
    existsSync: vi.fn().mockImplementation((pathStr: string) => {
        // Return true for files (containing extension), false for directories (to trigger mkdir)
        return pathStr.includes('.') && !pathStr.endsWith('/');
    }),
    promises: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined)
    }
};

vi.mock('fs', () => ({
    default: mockFs,
    ...mockFs,
    promises: mockFs.promises,
    existsSync: mockFs.existsSync
}));


vi.mock('./transport/SFTPTransporter', () => ({
  SFTPTransporter: class {
    isConnected = vi.fn().mockResolvedValue(false);
    disconnect = vi.fn();
  }
}));

// Partially mock ernService to call through or mock as needed
vi.mock('@/services/ddex/ERNService', () => ({
  ernService: {
    generateERN: vi.fn().mockResolvedValue({ success: true, xml: '<xml>mock</xml>' }),
    parseERN: vi.fn().mockReturnValue({ success: true, data: {} }),
    validateERNContent: vi.fn().mockReturnValue({ valid: true, errors: [] })
  }
}));

// Import service after mocks
import { DeliveryService } from '@/services/distribution/DeliveryService';
import { ernService } from '@/services/ddex/ERNService';

describe('DeliveryService Integration with Assets', () => {
    let service: DeliveryService;

    beforeEach(() => {
        service = new DeliveryService();
        vi.clearAllMocks();
    });

    it('should generate release package and copy assets', async () => {
        const mockMetadata: ExtendedGoldenMetadata = {
            upc: '1234567890123',
            trackTitle: 'Test Track',
            releaseTitle: 'Test Release',
            artistName: 'Test Artist',
            tracks: [], // Single
            isrc: 'US12345',
            catalogNumber: 'CAT123',
            genre: 'Pop',
            subGenre: 'Synth Pop',
            explicit: false,
            releaseDate: '2023-01-01',
            originalReleaseDate: '2023-01-01',
            labelName: 'Test Label',
            territories: ['Worldwide'],
            distributionChannels: ['streaming'],
            splits: []
        } as unknown as ExtendedGoldenMetadata;

        const mockAssets: ReleaseAssets = {
            audioFiles: [{
                url: '/tmp/source.wav',
                mimeType: 'audio/wav',
                sizeBytes: 1000,
                format: 'wav',
                sampleRate: 44100,
                bitDepth: 16
            }],
            coverArt: {
                url: '/tmp/cover.jpg',
                mimeType: 'image/jpeg',
                width: 1000,
                height: 1000,
                sizeBytes: 500
            }
        };

        const result = await service.generateReleasePackage(mockMetadata, '/tmp/output', mockAssets);

        expect(result.success).toBe(true);
        expect(ernService.generateERN).toHaveBeenCalledWith(mockMetadata, undefined, undefined, mockAssets);
        // Verify fs calls
        // Since we mocked 'fs', the dynamic import in DeliveryService should receive our mock
        // (Note: in some environments dynamic import of node built-ins behaves differently, but vi.mock('fs') is the best attempt)
        expect(mockFs.promises.copyFile).toHaveBeenCalled();
    });

    it('should handle multi-track assets', async () => {
        const mockMetadata: ExtendedGoldenMetadata = {
            // ...
            tracks: [
                { trackTitle: 'T1', isrc: 'US1' },
                { trackTitle: 'T2', isrc: 'US2' }
            ]
        } as unknown as ExtendedGoldenMetadata;

         const mockAssets: ReleaseAssets = {
            audioFiles: [
                { url: '/t1.wav', format: 'wav', mimeType: 'audio/wav', sizeBytes: 1, sampleRate: 44100, bitDepth: 16 },
                { url: '/t2.wav', format: 'wav', mimeType: 'audio/wav', sizeBytes: 1, sampleRate: 44100, bitDepth: 16 }
            ],
            coverArt: { url: '/c.jpg', mimeType: 'image/jpeg', width: 1, height: 1, sizeBytes: 1 }
        };

        await service.generateReleasePackage(mockMetadata, '/tmp/output', mockAssets);

        expect(ernService.generateERN).toHaveBeenCalled();
        expect(mockFs.promises.copyFile).toHaveBeenCalledTimes(3); // 2 audio + 1 cover
    });
});
