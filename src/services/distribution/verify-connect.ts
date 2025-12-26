
import { DistributorService } from './DistributorService';
import { credentialService } from '@/services/security/CredentialService';
import { IDistributorAdapter, DistributorCredentials, ReleaseResult } from './types/distributor';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

// Mock Adapter
class MockAdapter implements IDistributorAdapter {
    id = 'mock-distributor';
    name = 'Mock Distributor';
    connected = false;

    // Minimal implementation satisfying the interface
    requirements = {
        metadata: { requiredFields: [] as string[] },
        assets: {
            audio: { formats: ['wav'] as string[] },
            artwork: { minDimensions: { width: 1000, height: 1000 } }
        }
    };

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.apiKey) throw new Error('Missing API Key');
        this.connected = true;
        console.log(`[MockAdapter] Connected with key: ${credentials.apiKey}`);
    }

    async validateMetadata() { return { isValid: true, errors: [], warnings: [] }; }
    async validateAssets() { return { isValid: true, errors: [], warnings: [] }; }
    async createRelease(): Promise<ReleaseResult> {
        return { success: true, status: 'processing', distributorReleaseId: '123' };
    }
    async getReleaseStatus() { return 'live'; }
    async takedownRelease() { return { success: true, status: 'takedown_complete' }; } // Corrected return type
    async getEarnings() {
        return {
            period: { startDate: new Date(), endDate: new Date() },
            grossRevenue: 100,
            netRevenue: 80,
            distributorFee: 20,
            currency: 'USD',
            streams: 1000,
            downloads: 10,
            breakdown: []
        };
    }
    async isConnected() { return this.connected; }
}

async function verifyConnect() {
    console.log('🧪 Verifying DistributorService Connect Flow...');

    const distId = 'mock-distributor';
    const mockCreds = { apiKey: 'mock-api-key', apiSecret: 'mock-secret' };

    const adapter = new MockAdapter();
    DistributorService.registerAdapter(adapter);

    // cleanup
    await credentialService.deleteCredentials(distId);

    // 1. Test: Connect with new credentials (should save)
    console.log('\nTest 1: Connect with credentials (should save)...');
    await DistributorService.connect(distId, mockCreds);

    const saved = await credentialService.getCredentials(distId);
    if (saved?.apiKey === mockCreds.apiKey) {
        console.log('✅ Credentials saved successfully.');
    } else {
        console.error('❌ Failed to save credentials.');
        process.exit(1);
    }

    // Reset adapter connection manually to simulate fresh start
    adapter.connected = false;

    // 2. Test: Connect WITHOUT credentials (should load)
    console.log('\nTest 2: Connect WITHOUT credentials (should load)...');
    await DistributorService.connect(distId);

    if (adapter.connected) {
        console.log('✅ Connected using stored credentials.');
    } else {
        console.error('❌ Failed to connect with stored credentials.');
        process.exit(1);
    }

    // 3. Test: Fail when no credentials exist
    console.log('\nTest 3: Fail when no credentials exist...');
    await credentialService.deleteCredentials(distId);
    adapter.connected = false;

    try {
        await DistributorService.connect(distId);
        console.error('❌ Should have failed!');
        process.exit(1);
    } catch (e) {
        console.log('✅ Correctly failed with missing credentials:', (e as Error).message);
    }

    console.log('\n✨ All Connect Verification Tests Passed!');
}

verifyConnect().catch(e => {
    console.error('Verification failed:', e);
    process.exit(1);
});
