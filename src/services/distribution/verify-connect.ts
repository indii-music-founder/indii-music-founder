import { DistributorService } from './DistributorService';
import { credentialService } from '../security/CredentialService';
import { IDistributorAdapter, DistributorId, ReleaseResult, ReleaseStatus, DistributorEarnings, DistributorRequirements, ValidationResult } from './types/distributor';

// Mock Adapter for testing
class MockAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'distrokid';
    readonly name = 'Mock Distributor';
    readonly requirements: DistributorRequirements = {
        distributorId: 'distrokid',
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
    };

    async isConnected() { return false; }
    async connect(creds: any) { console.log('Mock connected', creds); }
    async disconnect() { console.log('Mock disconnected'); }

    async createRelease(metadata: any, assets: any): Promise<ReleaseResult> {
        console.log('Mock release created', metadata.title);
        return { success: true, status: 'processing', releaseId: 'mock-123' };
    }

    async updateRelease(releaseId: string, updates: any): Promise<ReleaseResult> {
        return { success: true, status: 'processing', releaseId };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        return 'live';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        return { success: true, status: 'takedown_requested', releaseId };
    }

    async getEarnings(releaseId: string, period: any): Promise<DistributorEarnings> {
        return {
            distributorId: 'distrokid',
            releaseId,
            period: { startDate: new Date().toISOString(), endDate: new Date().toISOString() },
            streams: 50000,
            downloads: 200,
            grossRevenue: 1000,
            distributorFee: 200,
            netRevenue: 800,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString(),
            breakdown: []
        };
    }

    async getAllEarnings(period: any): Promise<DistributorEarnings[]> {
        return [];
    }

    async validateMetadata(metadata: any): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }

    async validateAssets(assets: any): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }
}

async function verifyConnection() {
    const distId: DistributorId = 'distrokid';
    const mockCreds = { apiKey: 'test-key' };

    console.log('1. Registering Mock Adapter...');
    const adapter = new MockAdapter();
    DistributorService.registerAdapter(adapter);

    console.log('2. Clearing existing credentials...');
    await credentialService.deleteCredentials(distId);

    console.log('3. Connecting...');
    await DistributorService.connect(distId, mockCreds);

    console.log('4. Verifying persistence...');
    const saved = await credentialService.getCredentials(distId);
    if (saved && saved.apiKey === 'test-key') {
        console.log('✅ Credentials persisted securely');
    } else {
        console.error('❌ Persistence failed');
    }

    console.log('5. Re-connecting with saved creds...');
    await DistributorService.connect(distId);
    console.log('✅ Re-connection successful');

    console.log('6. Disconnecting...');
    await credentialService.deleteCredentials(distId);

    try {
        await DistributorService.connect(distId);
    } catch (e) {
        console.log('✅ Correctly failed to connect without credentials');
    }
}

verifyConnection().catch(console.error);
