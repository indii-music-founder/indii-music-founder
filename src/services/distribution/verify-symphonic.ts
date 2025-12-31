
import { SymphonicAdapter } from './adapters/SymphonicAdapter';
import type { ExtendedGoldenMetadata } from '../metadata/types';
import type { ReleaseAssets } from './types/distributor';
import * as fs from 'fs';
import * as path from 'path';

async function verifySymphonicIntegration() {
    console.log('🚀 Verifying Symphonic Integration...\n');

    // 1. Setup Adapter
    const symphonic = new SymphonicAdapter();
    await symphonic.connect({ apiKey: 'mock-key', accountId: 'PARTNER-123' });

    // 2. Setup Mock Data
    const mockMetadata: ExtendedGoldenMetadata = {
        trackTitle: 'Midnight City',
        artistName: 'M83',
        isrc: 'US-M83-11-00120',
        explicit: false,
        genre: 'Synthpop',
        splits: [],
        pro: 'ASCAP',  // Use valid PRO type (SACEM is not in the union)
        publisher: 'M83 Publishing',
        containsSamples: false,
        isGolden: true,
        labelName: 'Mute Records',
        dpid: 'PA-DPIDA-MOCK',
        upc: '724596951234',

        releaseType: 'Single',
        releaseDate: '2011-10-18',
        territories: ['Worldwide'],
        distributionChannels: ['streaming'],
        copyrightYear: '2011',
        copyrightOwner: 'Mute Records Ltd.',
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    } as ExtendedGoldenMetadata;

    // Create dummy assets for the test
    const dummyAudioPath = path.resolve('dummy_audio.wav');
    const dummyCoverPath = path.resolve('dummy_cover.jpg');
    fs.writeFileSync(dummyAudioPath, 'RIFF mock audio content');
    fs.writeFileSync(dummyCoverPath, 'mock image content');

    const mockAssets: ReleaseAssets = {
        audioFiles: [{
            url: `file://${dummyAudioPath}`,
            mimeType: 'audio/wav',
            sizeBytes: 1024,
            format: 'wav',
            sampleRate: 44100,
            bitDepth: 16,
        }],
        coverArt: {
            url: `file://${dummyCoverPath}`,
            mimeType: 'image/jpeg',
            width: 3000,
            height: 3000,
            sizeBytes: 1024,
        },
    };

    // 3. Execute Release Creation
    console.log('📦 Creating Release Package...');
    const result = await symphonic.createRelease(mockMetadata, mockAssets);

    // 4. Verify Result
    if (result.success && result.status === 'delivered') {
        console.log(`✅ Success! Release ID: ${result.releaseId}`);
        console.log(`✅ Status: ${result.status}`);
    } else {
        console.error('❌ Failed:', result);
    }

    // 5. Inspect Staging Directory
    // The release ID is generated dynamically, but we can verify the base staging dir exists
    // In a real verification we'd capture the releaseId from the builder, but here we inspect the Adapter's output
    // or just check if *any* new folder was created in ddex_staging

    // Cleanup
    if (fs.existsSync(dummyAudioPath)) fs.unlinkSync(dummyAudioPath);
    if (fs.existsSync(dummyCoverPath)) fs.unlinkSync(dummyCoverPath);

    console.log('\n✨ Verification Complete!');
}

verifySymphonicIntegration().catch(console.error);
