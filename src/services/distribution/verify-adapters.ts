
import { DistroKidAdapter } from './adapters/DistroKidAdapter.ts';
import { TuneCoreAdapter } from './adapters/TuneCoreAdapter.ts';
import { CDBabyAdapter } from './adapters/CDBabyAdapter.ts';
import { SymphonicAdapter } from './adapters/SymphonicAdapter.ts';
import { DistributorService } from './DistributorService.ts';
import { ernService } from '../ddex/ERNService.ts';
import { dsrService } from '../ddex/DSRService.ts';
import type { ExtendedGoldenMetadata } from '../metadata/types.ts';
import type { ReleaseAssets } from './types/distributor.ts';

async function verifyDistributionSystem() {
    console.log('🚀 Starting Distribution System Verification...\n');

    // 1. Register Adapters
    console.log('📦 Registering Adapters...');
    const distrokid = new DistroKidAdapter();
    const tunecore = new TuneCoreAdapter();
    const cdbaby = new CDBabyAdapter();

    DistributorService.registerAdapter(distrokid);
    DistributorService.registerAdapter(tunecore);
    DistributorService.registerAdapter(cdbaby);

    const registered = DistributorService.getRegisteredDistributors();
    console.log(`✅ Registered: ${registered.join(', ')}`);

    // 2. Mock Data
    const mockMetadata: ExtendedGoldenMetadata = {
        // GoldenMetadata base fields (FLAT)
        trackTitle: 'Neon Nights',
        artistName: 'The Synthwave Collective',
        isrc: 'US-DK1-25-00001',
        explicit: false,
        genre: 'Synthwave',
        splits: [],
        pro: 'ASCAP',
        publisher: 'Retro Records',
        containsSamples: false,
        isGolden: true,
        labelName: 'Retro Records',
        dpid: 'PA-DPIDA-2025122601-E',

        // Extended fields (FLAT)
        releaseType: 'Single',
        releaseDate: '2025-02-01',
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        copyrightYear: '2025',
        copyrightOwner: 'The Synthwave Collective',

        // Explicitly defining required Extended fields
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

    // 3. Test DistroKid
    console.log('\n🎵 Testing DistroKid...');
    await distrokid.connect({ apiKey: 'mock-key' });
    const dkValidation = await distrokid.validateMetadata(mockMetadata);
    console.log(`Validation: ${dkValidation.isValid ? 'PASS' : 'FAIL'}`);
    const dkRelease = await distrokid.createRelease(mockMetadata, mockAssets);
    console.log(`Release Creation: ${dkRelease.success ? 'SUCCESS' : 'FAILED'} (ID: ${dkRelease.distributorReleaseId})`);

    // 4. Test TuneCore
    console.log('\n🎵 Testing TuneCore...');
    await tunecore.connect({ accessToken: 'mock-token' });
    const tcRelease = await tunecore.createRelease(mockMetadata, mockAssets);
    console.log(`Release Creation: ${tcRelease.success ? 'SUCCESS' : 'FAILED'} (ID: ${tcRelease.distributorReleaseId})`);

    // 5. Test CD Baby
    console.log('\n🎵 Testing CD Baby...');
    await cdbaby.connect({ apiKey: 'mock-key' });
    const cdbRelease = await cdbaby.createRelease(mockMetadata, mockAssets);
    console.log(`Release Creation: ${cdbRelease.success ? 'SUCCESS' : 'FAILED'} (ID: ${cdbRelease.distributorReleaseId})`);

    // 6. Test Symphonic
    console.log('\n🎵 Testing Symphonic...');
    const symphonic = new SymphonicAdapter();
    DistributorService.registerAdapter(symphonic); // Register dynamically for this test
    await symphonic.connect({ apiKey: 'mock-key', accountId: 'partner-123' });
    const symValidation = await symphonic.validateMetadata(mockMetadata);
    console.log(`Validation: ${symValidation.isValid ? 'PASS' : 'FAIL'}`);
    const symRelease = await symphonic.createRelease(mockMetadata, mockAssets);
    console.log(`Release Creation: ${symRelease.success ? 'SUCCESS' : 'FAILED'} (ID: ${symRelease.distributorReleaseId})`);

    // 6. Test ERN Generation
    console.log('\n📄 Testing ERN Generation...');
    const ernResult = await ernService.generateERN(mockMetadata, 'PADPIDA2014040101U', 'PADPIDB2014040101U');
    if (ernResult.success && ernResult.xml) {
        console.log('✅ ERN XML Generated');
        console.log(`XML Length: ${ernResult.xml.length} chars`);
        // console.log(ernResult.xml.substring(0, 200) + '...');
    } else {
        console.error('❌ ERN Generation Failed:', ernResult.error);
    }

    // 7. Test DSR Ingestion
    console.log('\n📊 Testing DSR Ingestion...');
    const mockDSRContent = `TransactionId\tISRC\tTitle\tUsageType\tUsageCount\tRevenue\tCurrency\tTerritory
TX-001\tUS-DK1-25-00001\tNeon Nights\tStream\t1000\t5.00\tUSD\tUS
TX-002\tUS-DK1-25-00001\tNeon Nights\tDownload\t10\t9.90\tUSD\tUS`;

    const dsrResult = await dsrService.ingestFlatFile(mockDSRContent);
    if (dsrResult.success && dsrResult.data) {
        console.log('✅ DSR Parsed Successfully');
        console.log(`Transactions: ${dsrResult.data.transactions.length}`);
        console.log(`Total Revenue: $${dsrResult.data.summary.totalRevenue}`);
    } else {
        console.error('❌ DSR Parsing Failed:', dsrResult.error);
    }

    // 8. Test DDEX Validator
    if (ernResult.success && ernResult.xml) {
        console.log('\n🔍 Testing DDEX Validator...');
        // Dynamic import to avoid top-level resolution issues if file missing, though here we know it exists
        const { ddexValidator } = await import('../ddex/DDEXValidator.ts');
        const validationResult = ddexValidator.validateXML(ernResult.xml);
        console.log(`Validation Valid: ${validationResult.valid}`);
        if (!validationResult.valid) {
            console.error('Errors:', validationResult.errors);
        } else {
            console.log('✅ Generated ERN passed structural validation');
        }
    }

    console.log('\n✨ Verification Complete!');
}

verifyDistributionSystem().catch(console.error);
