import { SymphonicAdapter } from './adapters/SymphonicAdapter';
import { DistroKidAdapter } from './adapters/DistroKidAdapter';
import { TuneCoreAdapter } from './adapters/TuneCoreAdapter';
import { CDBabyAdapter } from './adapters/CDBabyAdapter';
import { ExtendedGoldenMetadata } from '../metadata/types';
import { ReleaseAssets } from './types/distributor';

async function runVerification() {
    console.log('=== VERIFYING DISTRIBUTION ADAPTERS ===\n');

    // 1. Setup Mock Metadata (using Golden Metadata standard)
    const mockMetadata: ExtendedGoldenMetadata = {
        trackTitle: 'Universal Harmony',
        artistName: 'The Generic Band',
        releaseDate: '2025-02-01',
        releaseType: 'Single',
        genre: 'Pop',
        pLineYear: 2025,
        cLineText: 'The Generic Band',
        language: 'en',
        isrc: 'US-GEN-25-00001',
        upc: '123456789012',
        catalogNumber: 'GEN-001',
        dpid: 'PADPIDA2014040101U',
        labelName: 'Generic Records',
        marketingComment: 'A test release for adapter verification.',
        originalReleaseDate: '2025-02-01',
        pLineText: 'The Generic Band',
        cLineYear: 2025,
        explicit: false,
        splits: [],
        pro: 'ASCAP',
        publisher: 'Generic Records',
        containsSamples: false,
        isGolden: true,
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    } as ExtendedGoldenMetadata;

    // 2. Setup Mock Assets (using local placeholders if available, or just mock URLs)
    // Note: ensure these paths exist or the builders might complain. 
    // For this test script, we expect the builders to handle "file://" paths.
    // We will assume a 'test-assets' folder exists or create a dummy file on the fly if needed.
    // Actually, let's use a dummy path that we won't actually read in "Dry Run" mode if possible,
    // but our builders DO copy files. So we need real files.
    // Let's create dummy files first in a temp dir.

    // We can rely on the fact that we can just create empty files for the test.
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tempDir = path.join(os.tmpdir(), 'indiiOS_verify_assets');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const audioPath = path.join(tempDir, 'test_audio.wav');
    const coverPath = path.join(tempDir, 'test_cover.jpg');

    fs.writeFileSync(audioPath, 'MOCK AUDIO DATA');
    fs.writeFileSync(coverPath, 'MOCK IMAGE DATA');

    const mockAssets: ReleaseAssets = {
        audioFile: {
            url: `file://${audioPath}`,
            mimeType: 'audio/wav',
            format: 'wav',
            sizeBytes: 1024,
            sampleRate: 44100,
            bitDepth: 16
        },
        coverArt: {
            url: `file://${coverPath}`,
            mimeType: 'image/jpeg',
            width: 3000,
            height: 3000,
            sizeBytes: 2048
        }
    };

    // 3. Initialize Adapters
    const adapters = [
        new SymphonicAdapter(),
        new DistroKidAdapter(),
        new TuneCoreAdapter(),
        new CDBabyAdapter()
    ];

    console.log(`Initialized ${adapters.length} adapters: ${adapters.map(a => a.name).join(', ')}\n`);

    // 4. Run Verification Loop
    for (const adapter of adapters) {
        console.log(`--- Testing ${adapter.name} ---`);
        try {
            // A. Connect
            console.log('Connecting...');
            await adapter.connect({
                apiKey: 'test-api-key',
                accessToken: 'test-access-token',
                accountId: 'test-account'
            });

            // B. Create Release
            console.log('Creating Release...');
            const result = await adapter.createRelease(mockMetadata, mockAssets);

            if (result.success && result.status === 'delivered') {
                console.log(`✅ SUCCESS: Release delivered via ${adapter.name}`);
                console.log(`   Release ID: ${result.releaseId}`);
                console.log(`   Distributor Ref: ${result.distributorReleaseId}`);
                if (adapter.name === 'Symphonic' || adapter.name === 'DistroKid' || adapter.name === 'CD Baby') {
                    console.log(`   Note: Check 'ddex_staging' folder for output artifacts.`);
                }
            } else {
                console.error(`❌ FAILURE: ${adapter.name} failed to deliver.`);
                console.error('   Status:', result.status);
                console.error('   Errors:', result.errors);
            }

            // C. Disconnect
            await adapter.disconnect();

        } catch (error) {
            console.error(`🚨 CRITICAL ERROR in ${adapter.name}:`, error);
        }
        console.log('\n');
    }

    console.log('=== VERIFICATION COMPLETE ===');
}

runVerification().catch(console.error);
