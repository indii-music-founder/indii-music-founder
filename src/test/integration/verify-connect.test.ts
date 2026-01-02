import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistributorService } from '@/services/distribution/DistributorService';
import { DistributorId, IDistributorAdapter, DistributorRequirements } from '@/services/distribution/types/distributor';

// Mock credential service
vi.mock('@/services/security/CredentialService', () => {
    const store = new Map<string, Record<string, string>>();
    return {
        credentialService: {
            saveCredentials: vi.fn(async (id: string, creds: Record<string, string>) => {
                store.set(id, creds);
            }),
            getCredentials: vi.fn(async (id: string) => {
                return store.get(id) || null;
            }),
            deleteCredentials: vi.fn(async (id: string) => {
                store.delete(id);
            })
        }
    };
});

// Create a mock adapter
function createMockAdapter(id: DistributorId = 'distrokid'): IDistributorAdapter {
    return {
        id,
        name: 'Mock Distributor',
        requirements: {
            distributorId: id,
            coverArt: {
                minWidth: 3000,
                minHeight: 3000,
                maxWidth: 5000,
                maxHeight: 5000,
                aspectRatio: '1:1',
                allowedFormats: ['jpg', 'png'],
                maxSizeBytes: 10485760,
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
                requiredFields: ['title', 'artist'],
                maxTitleLength: 100,
                maxArtistNameLength: 100,
                isrcRequired: true,
                upcRequired: true,
                genreRequired: true,
                languageRequired: true
            },
            timing: {
                minLeadTimeDays: 7,
                reviewTimeDays: 2
            },
            pricing: {
                model: 'subscription',
                payoutPercentage: 100
            }
        } as DistributorRequirements,
        isConnected: vi.fn().mockResolvedValue(false),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        createRelease: vi.fn().mockResolvedValue({ success: true, status: 'processing', releaseId: 'mock-123' }),
        updateRelease: vi.fn().mockResolvedValue({ success: true, status: 'processing', releaseId: 'mock-123' }),
        getReleaseStatus: vi.fn().mockResolvedValue('live'),
        takedownRelease: vi.fn().mockResolvedValue({ success: true, status: 'takedown_requested', releaseId: 'mock-123' }),
        getEarnings: vi.fn().mockResolvedValue({
            distributorId: id,
            releaseId: 'mock-123',
            period: { startDate: new Date().toISOString(), endDate: new Date().toISOString() },
            streams: 50000,
            downloads: 200,
            grossRevenue: 1000,
            distributorFee: 200,
            netRevenue: 800,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString(),
            breakdown: []
        }),
        getAllEarnings: vi.fn().mockResolvedValue([]),
        validateMetadata: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
        validateAssets: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] })
    };
}

describe('DistributorService Connection', () => {
    const testId: DistributorId = 'distrokid';
    const mockCreds = { apiKey: 'test-key' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register an adapter', () => {
        const adapter = createMockAdapter(testId);
        DistributorService.registerAdapter(adapter);

        const registered = DistributorService.getRegisteredDistributors();
        expect(registered).toContain(testId);
    });

    it('should connect with credentials', async () => {
        const adapter = createMockAdapter(testId);
        DistributorService.registerAdapter(adapter);

        await DistributorService.connect(testId, mockCreds);

        expect(adapter.connect).toHaveBeenCalledWith(mockCreds);
    });
});
