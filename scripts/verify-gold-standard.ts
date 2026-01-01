
import { IdentifierService } from '../src/services/identity/IdentifierService';
import { FraudDetectionService } from '../src/services/security/FraudDetectionService';
import { RoyaltyService } from '../src/services/finance/RoyaltyService';
import { ERNMapper } from '../src/services/ddex/ERNMapper';
import { ExtendedGoldenMetadata } from '../src/services/metadata/types';

/**
 * Gold Standard Verification Script
 * Checks "Critical" features: Identity, Fraud, Finance, Metadata.
 */

async function main() {
    console.log("🔍 Starting Gold Standard Verification...\n");
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, msg: string) {
        if (condition) {
            console.log(`✅ [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${msg}`);
            failed++;
        }
    }

    // 1. Identity Verification
    console.log("\n--- 1. Identity Infrastructure ---");
    try {
        const isrc = IdentifierService.generateISRC(24, 1);
        assert(IdentifierService.validateISRC(isrc), `Generated ISRC ${isrc} is valid`);

        const upc = IdentifierService.generateUPC('03600029145');
        assert(IdentifierService.validateUPC(upc), `Generated UPC ${upc} is valid`);
        assert(IdentifierService.validateUPC('036000291452'), `Validates known good UPC`);
        assert(!IdentifierService.validateUPC('036000291450'), `Rejects bad checksum UPC`);
    } catch (e) {
        console.error("Identity Error:", e);
        failed++;
    }

    // 2. Fraud Detection
    console.log("\n--- 2. Fraud Detection ---");
    const events = [
        { trackId: 't1', userId: 'u1', timestamp: 1000, durationPlayed: 30, ipAddress: '1.1.1.1', userAgent: 'Bot' },
        // Create looping pattern
        ...Array(25).fill(0).map((_, i) => ({
            trackId: 't1', userId: 'u1', timestamp: 1000 + (i * 1000), durationPlayed: 30, ipAddress: '1.1.1.1', userAgent: 'Bot'
        }))
    ];

    const fraudAlerts = FraudDetectionService.detectArtificialStreaming(events);
    assert(fraudAlerts.length > 0, "Detected looping behavior");
    assert(fraudAlerts[0]?.severity === 'HIGH', "Flagged as HIGH severity");

    const acrResult = await FraudDetectionService.checkCopyright("http://bucket/copyright_infringement.mp3");
    assert(acrResult.safe === false, "ACR Stub detected infringement");

    // 3. Finance Engine
    console.log("\n--- 3. Finance Engine ---");
    const mockMetadata: Record<string, ExtendedGoldenMetadata> = {
        'USQY12400001': {
            trackTitle: 'Hit Song',
            isrc: 'USQY12400001',
            splits: [
                { legalName: 'Artist', role: 'performer', percentage: 50, email: 'artist@test.com' },
                { legalName: 'Producer', role: 'producer', percentage: 50, email: 'prod@test.com' }
            ],
            // ... minimal required fields for type satisfaction
            artistName: 'Artist',
            explicit: false,
            genre: 'Pop',
            labelName: 'Label',
            pro: 'None',
            publisher: 'Self',
            containsSamples: false,
            samples: [],
            isGolden: true,
            releaseType: 'Single',
            releaseDate: '2024-01-01',
            territories: ['Worldwide'],
            distributionChannels: ['streaming'],
            aiGeneratedContent: { isFullyAIGenerated: false, isPartiallyAIGenerated: false }
        }
    };

    const revenue = [
        { transactionId: 'tx1', isrc: 'USQY12400001', platform: 'Spotify', territory: 'US', grossRevenue: 100.00, currency: 'USD' }
    ];

    const payouts = RoyaltyService.calculateSplits(revenue, mockMetadata);
    assert(payouts.length === 2, "Split revenue into 2 payouts");
    assert(payouts.find(p => p.userId === 'artist@test.com')?.amount === 50.00, "Artist got 50%");
    assert(payouts.find(p => p.userId === 'prod@test.com')?.amount === 50.00, "Producer got 50%");

    // 4. DDEX Metadata
    console.log("\n--- 4. DDEX Metadata ---");
    // Just verifying the import and basic usage, deep XML validation is complex for this script
    try {
        const ern = ERNMapper.mapMetadataToERN(mockMetadata['USQY12400001'], {
            messageId: 'MSG1',
            sender: 'PARTY1',
            recipient: 'SPOTIFY',
            createdDateTime: '2024-01-01T00:00:00Z'
        });
        assert(ern.messageHeader.messageId === 'MSG1', "Generated ERN Object");
        assert(ern.releaseList[0].contributors.length > 0, "Mapped Contributors");
    } catch (e) {
        console.error(e);
        assert(false, "ERN Generation Failed");
    }

    console.log(`\n\n🏁 Verification Complete. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

main().catch(console.error);
