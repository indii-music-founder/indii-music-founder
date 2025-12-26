
import { v4 as uuidv4 } from 'uuid';
import { IDistributorAdapter } from './types/distributor.ts';
import { DistributorService } from './DistributorService.ts';
import { DistributionPersistenceService } from './DistributionPersistenceService.ts';
import type { ExtendedGoldenMetadata } from '../metadata/types.ts';
import type { ReleaseAssets } from './types/distributor.ts';

async function verifyHardening() {
    console.log('🚀 Starting Distribution Hardening Verification...\n');

    // 0. Setup
    const releaseId = uuidv4();
    console.log(`🆔 Test Internal Release ID: ${releaseId}`);

    // Initialize store with local CWD to avoid Electron path errors
    const localStore = new DistributionPersistenceService({ cwd: process.cwd() });
    localStore.clearAll();
    console.log('🧹 Store Cleared (Local CWD)');

    // Inject local store into DistributorService
    DistributorService.setPersistenceService(localStore);

    // 1. Register Mock Adapter
    class MockAdapter implements IDistributorAdapter {
        id = 'distrokid' as const;
        name = 'Mock DistroKid';
        requirements = {
            distributorId: 'distrokid' as const,
            coverArt: {
                minWidth: 1400,
                minHeight: 1400,
                maxWidth: 3000,
                maxHeight: 3000,
                aspectRatio: '1:1' as const,
                allowedFormats: ['jpg' as const, 'png' as const],
                maxSizeBytes: 5000000,
                colorMode: 'RGB' as const
            },
            audio: {
                allowedFormats: ['wav' as const, 'flac' as const],
                minSampleRate: 44100,
                recommendedSampleRate: 44100,
                minBitDepth: 16,
                channels: 'stereo' as const
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
                model: 'subscription' as const,
                annualFee: 19.99,
                payoutPercentage: 100
            }
        };

        async connect() { }
        async disconnect() { }
        async isConnected() { return true; }

        async validateMetadata() { return { isValid: true, errors: [], warnings: [] }; }
        async validateAssets() { return { isValid: true, errors: [], warnings: [] }; }

        async createRelease() {
            return {
                success: true,
                status: 'delivered' as const,
                distributorReleaseId: 'DK-MOCK-123',
                errors: []
            };
        }

        async updateRelease() {
            return {
                success: true,
                status: 'delivered' as const,
                distributorReleaseId: 'DK-MOCK-123',
                errors: []
            };
        }

        async getReleaseStatus() { return 'live' as const; }

        async getEarnings() {
            return {
                distributorId: 'distrokid' as const,
                releaseId: 'mock-release',
                period: { startDate: '2025-01-01', endDate: '2025-01-31' },
                streams: 0,
                downloads: 0,
                grossRevenue: 0,
                distributorFee: 0,
                netRevenue: 0,
                currencyCode: 'USD',
                lastUpdated: new Date().toISOString()
            };
        }

        async getAllEarnings() { return []; }

        async takedownRelease() {
            return { success: true, status: 'takedown_requested' as const, errors: [] };
        }
    }

    const mockAdapter = new MockAdapter();
    DistributorService.registerAdapter(mockAdapter);
    console.log('📦 Registered Mock Adapter');

    // 2. Create Mock Data with ID
    const mockMetadata: ExtendedGoldenMetadata = {
        id: releaseId,
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
        audioFile: {
            url: 'file:///path/to/song.wav',
            mimeType: 'audio/wav',
            sizeBytes: 40 * 1024 * 1024,
            format: 'wav',
            sampleRate: 44100,
            bitDepth: 16,
        },
        coverArt: {
            url: 'file:///path/to/cover.jpg',
            mimeType: 'image/jpeg',
            width: 3000,
            height: 3000,
            sizeBytes: 5 * 1024 * 1024,
        },
    };

    // 3. Create Release (Should trigger save)
    console.log('\n📤 Submitting Release...');
    const result = await DistributorService.createRelease('distrokid', mockMetadata, mockAssets);

    if (result.success) {
        console.log(`✅ Release Created! External ID: ${result.distributorReleaseId}`);
    } else {
        console.error('❌ Release Creation Failed', result.errors);
        return;
    }

    // 4. Verify Immediate Persistence
    console.log('\n💾 Verifying Persistence...');
    let deployments = localStore.getDeploymentsForRelease(releaseId);
    if (deployments.length === 1) {
        console.log(`✅ Persistence Found: [${deployments[0].status}] ${deployments[0].distributorId}`);
    } else {
        console.error(`❌ Persistence Failed. Found ${deployments.length} records.`);
    }

    // 5. Simulate "App Restart" & Status Check
    console.log('\n🔄 Simulating App Restart & Status Check...');
    // In a real restart, memory is cleared. Here we rely on the file-based store (electron-store)

    // Check status across distributors (should hit store index)
    const statuses = await DistributorService.getReleaseStatusAcrossDistributors(releaseId);
    console.log('Status Report:', statuses);

    // Verify store was updated (simulating that the getStatus call refreshed it)
    deployments = localStore.getDeploymentsForRelease(releaseId);
    console.log(`Current Store Status: ${deployments[0].status}`);

    console.log('\n✨ Hardening Verification Complete!');
}

verifyHardening().catch(console.error);
