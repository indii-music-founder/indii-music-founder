
import { TranscodingService } from '../src/services/audio/TranscodingService';
import { BatchDeliveryService } from '../src/services/distribution/BatchDeliveryService';
import { ernService } from '../src/services/ddex/ERNService';
import { deliveryService } from '../src/services/distribution/DeliveryService';
import { FraudDetectionService } from '../src/services/security/FraudDetectionService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '../src/services/metadata/types';

/**
 * DDEX Roadmap Verification Script
 * Validates:
 * 1. Transcoding stub functionality (Stage 3).
 * 2. Batch Delivery Manifest generation (Stage 3).
 * 3. Test Mode (Peer Conformance) flag in ERN (Stage 4).
 * 4. Validation integrity checks (Stage 2) + Artwork Specs.
 * 5. Broad Spectrum ACR (Fraud).
 */

async function main() {
    console.log("🔍 Starting DDEX Roadmap Verification...\n");
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, msg: string, errors?: string[]) {
        if (condition) {
            console.log(`✅ [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${msg}`);
            if (errors) console.error("   Errors:", errors);
            failed++;
        }
    }

    // 1. Transcoding Verification
    console.log("\n--- 1. Transcoding Architecture (Stage 3) ---");
    const ts = new TranscodingService();
    const transcodeResult = await ts.transcode({
        inputPath: 'master.wav',
        outputPath: 'output.ogg',
        targetFormat: 'ogg'
    });
    assert(transcodeResult === true, "Transcoding stub accepted valid .wav input");

    const badInput = await ts.transcode({ inputPath: 'song.mp3', outputPath: 'out.ogg', targetFormat: 'ogg' });
    assert(badInput === false, "Transcoding stub rejected .mp3 input (only accepts masters)");


    // 2. Batch Delivery Verification
    console.log("\n--- 2. Batch Delivery Logic (Stage 3) ---");
    const manifestXml = BatchDeliveryService.generateBatchManifest({
        batchId: 'BATCH_123',
        messageSender: 'MY_DPID',
        messageRecipient: 'SPOTIFY_DPID',
        releaseCount: 5,
        createdDateTime: '2024-01-01T12:00:00Z'
    });

    assert(manifestXml.includes('<BatchId>BATCH_123</BatchId>'), "Manifest contains BatchId");
    assert(manifestXml.includes('<NumberOfReleasesInBatch>5</NumberOfReleasesInBatch>'), "Manifest contains ReleaseCount");
    assert(manifestXml.includes('BatchCompleteMessage'), "Manifest is correct DDEX Message Type");


    // 3. Peer Conformance (Test Mode)
    console.log("\n--- 3. Peer Conformance (Stage 4) ---");
    const mockMetadata: ExtendedGoldenMetadata = {
        ...INITIAL_METADATA,
        trackTitle: 'Test Track',
        artistName: 'Test Artist',
        isrc: 'US1234567890',
        upc: '123456789012',
        releaseType: 'Single',
        releaseDate: '2024-01-01',
        territories: ['Worldwide'],
        distributionChannels: ['streaming'],
        isGolden: true,
        aiGeneratedContent: { isFullyAIGenerated: false, isPartiallyAIGenerated: false }
    };

    // Live Mode
    const liveResult = await ernService.generateERN(mockMetadata, 'MY_DPID', 'generic', undefined, { isTestMode: false });
    assert(liveResult.xml!.includes('<MessageControlType>LiveMessage</MessageControlType>'), "Default/Live generates LiveMessage");

    // Test Mode
    const testResult = await ernService.generateERN(mockMetadata, 'MY_DPID', 'generic', undefined, { isTestMode: true });
    assert(testResult.xml!.includes('<MessageControlType>TestMessage</MessageControlType>'), "Test Mode generates TestMessage");

    // 4. Validation (Stage 2 & Artwork)
    console.log("\n--- 4. Ingestion Validation (Stage 2) & Artwork Specs ---");

    // Valid Case: 3000x3000px, JPG
    const validAssets = {
        audioFiles: [{ url: 'track1.wav', format: 'wav', trackIndex: 0 }],
        coverArt: { url: 'cover.jpg', width: 3000, height: 3000 }
    } as any;
    const validationPass = await deliveryService.validateReleasePackage(mockMetadata, validAssets);
    assert(validationPass.valid === true, "Validation passes for 3000x3000px JPG", validationPass.errors);

    // Invalid Case: Non-Square
    const nonSquare = {
        audioFiles: [{ url: 'track1.wav', format: 'wav', trackIndex: 0 }],
        coverArt: { url: 'cover.jpg', width: 3000, height: 2000 }
    } as any;
    const failNonSquare = await deliveryService.validateReleasePackage(mockMetadata, nonSquare);
    assert(failNonSquare.valid === false, "Rejected non-square artwork");
    assert(failNonSquare.errors.some(e => e.includes('Aspect ratio')), "Error message mentions aspect ratio", failNonSquare.errors);

    // Invalid Case: Too Small
    const tooSmall = {
        audioFiles: [{ url: 'track1.wav', format: 'wav', trackIndex: 0 }],
        coverArt: { url: 'cover.jpg', width: 1000, height: 1000 }
    } as any;
    const failSmall = await deliveryService.validateReleasePackage(mockMetadata, tooSmall);
    assert(failSmall.valid === false, "Rejected small artwork (1000x1000)");
    assert(failSmall.errors.some(e => e.includes('Dimensions')), "Error message mentions dimensions", failSmall.errors);

    // Invalid Case: Bad Format (BMP)
    const badFormat = {
        audioFiles: [{ url: 'track1.wav', format: 'wav', trackIndex: 0 }],
        coverArt: { url: 'cover.bmp', width: 3000, height: 3000 }
    } as any;
    const failFormat = await deliveryService.validateReleasePackage(mockMetadata, badFormat);
    assert(failFormat.valid === false, "Rejected BMP format");
    assert(failFormat.errors.some(e => e.includes('Format')), "Error message mentions format", failFormat.errors);

    // 5. Broad Spectrum ACR
    console.log("\n--- 5. Broad Spectrum ACR (Fraud) ---");
    const cleanAudio = await FraudDetectionService.checkBroadSpectrum('track1_master.wav');
    assert(cleanAudio.safe === true, "Standard audio passes Broad Spectrum check");

    const spedUp = await FraudDetectionService.checkBroadSpectrum('track1_sped_up_nightcore.wav');
    assert(spedUp.safe === false, "Detected 'sped up' content");
    assert(spedUp.details?.includes('Pitch/Tempo'), "Alert mentions Pitch/Tempo shift");

    console.log(`\n\n🏁 Verification Complete. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

main().catch(console.error);
