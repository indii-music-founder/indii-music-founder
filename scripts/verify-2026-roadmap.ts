
import { SmartContractService } from '../src/services/blockchain/SmartContractService';
import { CanonicalMapService } from '../src/services/distribution/CanonicalMapService';
import { transcodingService } from '../src/services/audio/TranscodingService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '../src/services/metadata/types';

/**
 * 2026 Roadmap Verification Script
 * Validates:
 * 1. Blockchain Smart Contracts (Gap 1)
 * 2. Canonical Map / Supply Chain (Gap 2)
 * 3. Spatial Audio Support (Gap 4)
 */

async function main() {
    console.log("🔍 Starting 2026 Roadmap Verification...\n");
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

    // 1. Blockchain / Trust Protocol
    console.log("\n--- 1. Blockchain Trust Protocol ---");
    const contractService = new SmartContractService();
    try {
        const contractAddr = await contractService.deploySplitContract({
            isrc: 'US-XYZ-26-00001',
            payees: [
                { walletAddress: '0xArtist', percentage: 50, role: 'Artist' },
                { walletAddress: '0xProducer', percentage: 50, role: 'Producer' }
            ]
        });
        assert(contractAddr.startsWith('0x'), "Smart Contract deployed with address");

        // Verify Immutable Ledger
        const history = await contractService.getChainOfCustody('US-XYZ-26-00001');
        assert(history.length > 0, "Chain of Custody recorded deployment");
        assert(history[0].action === 'SPLIT_EXECUTION', "Ledger recorded Split Execution");

        // Tokenization
        const tokenAddr = await contractService.tokenizeAsset('US-XYZ-26-00001', 1000);
        assert(tokenAddr.startsWith('0xToken'), "Asset Tokenized (SongShares) minted");

    } catch (e) {
        console.error(e);
        assert(false, "Blockchain operations failed");
    }


    // 2. Canonical Map (Supply Chain)
    console.log("\n--- 2. Supply Chain (Canonical Map) ---");
    const validMetadata: ExtendedGoldenMetadata = {
        ...INITIAL_METADATA,
        trackTitle: '2026 Hit',
        artistName: 'Future Artist',
        isrc: 'US-XYZ-26-00001',
        upc: '123456789012',
        tracks: [
            {
                ...INITIAL_METADATA,
                isrc: 'US-XYZ-26-00001',
                trackTitle: 'Track 1',
                iswc: 'T-123.456.789-0' // Present
            }
        ]
    } as any;

    const validMap = CanonicalMapService.validateHierarchy(validMetadata);
    assert(validMap.valid === true, "Canonical Map accepts valid hierarchy (ISWC->ISRC->UPC)");

    const invalidMetadata: ExtendedGoldenMetadata = {
        ...INITIAL_METADATA,
        trackTitle: 'Black Box Risk',
        upc: '123456789012',
        tracks: [
            {
                ...INITIAL_METADATA,
                isrc: 'US-XYZ-26-00002',
                trackTitle: 'Track 1'
                // Missing ISWC
            }
        ]
    } as any;

    const invalidMap = CanonicalMapService.validateHierarchy(invalidMetadata);
    assert(invalidMap.valid === false, "Canonical Map rejects missing ISWC (Black Box prevention)");
    assert(invalidMap.error?.includes('Composition rights unlinked'), "Error message specifies ISWC gap");


    // 3. Spatial Audio (Future Tech)
    console.log("\n--- 3. Spatial Audio Support ---");
    assert(transcodingService.isSpatialAudio('master_atmos.wav') === true, "Detected ADM BWF (Atmos) file");
    assert(transcodingService.isSpatialAudio('master.wav') === false, "Standard WAV is not Atmos");


    console.log(`\n\n🏁 Verification Complete. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

main().catch(console.error);
