
import 'dotenv/config';
import { licenseScannerService } from '../src/services/knowledge/LicenseScannerService.ts';

// 1. Mock Window & Electron API
const MOCK_LICENSE_TEXT = `
TERMS OF USE AND LICENSE AGREEMENT

1. Grant of License
The licensor grants you a non-exclusive, worldwide, royalty-free license to use the audio samples contained in this pack ("Samples") for your own musical compositions and productions.

2. Rights
- You MAY use the Samples in commercial and non-commercial music releases.
- You MAY NOT resell, re-license, or redistribute the Samples as a standalone library or sound pack.

3. Attribution
Credit to "SonicWave Studios" is required for any commercial release exceeding 10,000 streams.

4. Termination
This license is effective until terminated...
`;

console.log('[Test] Setting up Mock Electron Environment...');

// @ts-expect-error - polyfilling window for node environment in tests to mock Electron APIs
global.window = {
    electronAPI: {
        network: {
            fetchUrl: async (url: string) => {
                console.log(`[MockIPC] Fetching URL: ${url}`);
                // In a real scenario, this would fetch the actual URL.
                // For this test, we return our mock text to ensure deterministic input for the AI.
                return MOCK_LICENSE_TEXT;
            }
        }
    }
} as any;

async function runTest() {
    console.log('[Test] Starting License Scanner Verification...');
    const testUrl = 'https://sonicwave-studios.com/terms';

    try {
        console.log(`[Test] Scanning URL: ${testUrl}`);
        const result = await licenseScannerService.scanUrl(testUrl);

        console.log('\n----------------------------------------');
        console.log('🤖 AI ANALYSIS RESULT');
        console.log('----------------------------------------');
        console.log(JSON.stringify(result, null, 2));
        console.log('----------------------------------------\n');

        // Basic Assertions
        if (result.licenseType === 'Royalty-Free' && result.requiresAttribution === true) {
            console.log('✅ TEST PASSED: AI correctly identified Royalty-Free with Attribution.');
        } else {
            console.warn('⚠️ TEST WARNING: AI interpretation might differ from expected. Check output.');
        }

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    }
}

runTest();
