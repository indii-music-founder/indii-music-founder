import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistributorService } from '@/services/distribution/DistributorService';
import { IDistributorAdapter, DistributorId, ReleaseAssets } from '@/services/distribution/types/distributor';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user' } }
}));

// Mock persistence service
vi.mock('@/services/distribution/DistributionPersistenceService', () => ({
    DistributionPersistenceService: vi.fn().mockImplementation(() => ({
        saveDeployment: vi.fn().mockResolvedValue(undefined),
        getDeploymentsForRelease: vi.fn().mockResolvedValue([
            { distributorId: 'distrokid', status: 'delivered', releaseId: 'test-release' }
        ]),
        updateDeploymentStatus: vi.fn().mockResolvedValue(undefined)
    }))
}));

// Create a mock adapter
function createMockAdapter(): IDistributorAdapter {
    return {
        id: 'distrokid' as DistributorId,
        name: 'Mock DistroKid',
        requirements: {
            distributorId: 'distrokid',
            coverArt: {
                minWidth: 1400,
                minHeight: 1400,
                maxWidth: 3000,
                maxHeight: 3000,
                aspectRatio: '1:1',
                allowedFormats: ['jpg', 'png'],
                maxSizeBytes: 5000000,
                colorMode: 'RGB'
            },
            audio: {
                allowedFormats: ['wav', 'flac'],
                minSampleRate: 44100,
                recommendedSampleRate: 44100,
                minBitDepth: 16,
                channels: 'stereo'
            },
            metadata: {
                requiredFields: ['trackTitle', 'artistName'],
                maxTitleLength: 255,
                maxArtistNameLength: 255,
                isrcRequired: false,
                upcRequired: false,
                genreRequired: true,
                languageRequired: false
            },
            timing: {
                minLeadTimeDays: 1,
                reviewTimeDays: 1
            },
            pricing: {
                model: 'subscription',
                annualFee: 19.99,
                payoutPercentage: 100
            }
        },
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockResolvedValue(true),
        validateMetadata: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
        validateAssets: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
        createRelease: vi.fn().mockResolvedValue({
            success: true,
            status: 'delivered',
            distributorReleaseId: 'DK-MOCK-123',
            errors: []
        }),
        updateRelease: vi.fn().mockResolvedValue({
            success: true,
            status: 'delivered',
            distributorReleaseId: 'DK-MOCK-123',
            errors: []
        }),
        getReleaseStatus: vi.fn().mockResolvedValue('live'),
        getEarnings: vi.fn().mockResolvedValue({
            distributorId: 'distrokid',
            releaseId: 'mock-release',
            period: { startDate: '2025-01-01', endDate: '2025-01-31' },
            streams: 0,
            downloads: 0,
            grossRevenue: 0,
            distributorFee: 0,
            netRevenue: 0,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString()
        }),
        getAllEarnings: vi.fn().mockResolvedValue([]),
        takedownRelease: vi.fn().mockResolvedValue({ success: true, status: 'takedown_requested', errors: [] })
    };
}

describe('Distribution Hardening', () => {
    const mockMetadata: ExtendedGoldenMetadata = {
        id: 'test-release-id',
        trackTitle: 'Persistent Dreams',
        artistName: 'The State Machines',
        isrc: 'US-DK1-25-99999',
        explicit: false,
        genre: 'Synthwave',
        splits: [],
        pro: 'ASCAP',
        publisher: 'Retro Records',
        containsSamples: false,
        isGolden: true,
        labelName: 'Retro Records',
        releaseType: 'Single',
        releaseDate: '2025-05-01',
        territories: ['Worldwide'],
        distributionChannels: ['streaming'],
        copyrightYear: '2025',
        copyrightOwner: 'The State Machines',
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    } as ExtendedGoldenMetadata;

    const mockAssets: ReleaseAssets = {
        audioFiles: [{
            url: 'file:///path/to/song.wav',
            mimeType: 'audio/wav',
            sizeBytes: 40 * 1024 * 1024,
            format: 'wav',
            sampleRate: 44100,
            bitDepth: 16,
        }],
        coverArt: {
            url: 'file:///path/to/cover.jpg',
            mimeType: 'image/jpeg',
            width: 3000,
            height: 3000,
            sizeBytes: 5 * 1024 * 1024,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register mock adapter', () => {
        const adapter = createMockAdapter();
        DistributorService.registerAdapter(adapter);

        const registered = DistributorService.getRegisteredDistributors();
        expect(registered).toContain('distrokid');
    });

    it('should create release successfully', async () => {
        const adapter = createMockAdapter();
        DistributorService.registerAdapter(adapter);

        const result = await DistributorService.createRelease('distrokid', mockMetadata, mockAssets);

        expect(result.success).toBe(true);
        expect(result.distributorReleaseId).toBe('DK-MOCK-123');
    });
});
