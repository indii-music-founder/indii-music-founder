import { test, expect } from '@playwright/test';
import * as path from 'path';

test('Audio Intelligence Service - End-to-End Verification', async ({ page }) => {
    test.setTimeout(90000); // 90s timeout for Gemini
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // 1. Load the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 2. Prepare a sample audio file in the browser context
    // We'll use the existing sample-6s.mp3 at project root
    const sampleAudioPath = path.resolve(process.cwd(), 'sample-6s.mp3');

    // 3. Inject code to load the file and run analysis
    const analysisResult = await page.evaluate(async () => {
        // @ts-expect-error - Checking for property existence on unknown global type
        const audioService = window.audioIntelligence;
        if (!audioService) throw new Error("AudioIntelligenceService not found on window");

        // Fetch the sample file (assuming it's served or we can simulate a File object)
        // Since we can't easily fetch local files in browser context without serving them,
        // We will simulate a file upload or use a data URI if possible.
        // Actually, we can just create a dummy buffer for the TECHNICAL check, 
        // but for SEMANTIC check (Gemini) we want real audio.

        // Let's try to fetch a public asset if available.
        // If not, we might fail "real music" check.
        // Assuming 'sample-6s.mp3' is in the root, maybe it's not served.
        // Let's generate a clear sine wave buffer to prove Essentia works at least?
        // No, user wants "Real Music".

        // ALTERNATIVE: Mock the File object with base64 data injected from Node.
        return "READY_TO_RECEIVE";
    });

    expect(analysisResult).toBe("READY_TO_RECEIVE");

    // Read the file in Node
    const fs = await import('fs');
    const buffer = fs.readFileSync(sampleAudioPath);
    const base64 = buffer.toString('base64');
    const mimeType = 'audio/mp3';

    // 4. Pass Base64 to browser, convert to File, and Analyze
    const profile = await page.evaluate(async ({ base64, mimeType }) => {
        // Helper to base64 -> Blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const file = new File([blob], "sample-6s.mp3", { type: mimeType });

        // @ts-expect-error - Checking for property existence on unknown global type
        return await window.audioIntelligence.analyze(file);
    }, { base64, mimeType });

    // 5. Verify Results
    console.log("Analysis Profile:", JSON.stringify(profile, null, 2));

    // Technical Check (Essentia)
    expect(profile.technical).toBeDefined();
    expect(typeof profile.technical.bpm).toBe('number');
    expect(profile.technical.bpm).toBeGreaterThan(0);
    expect(typeof profile.technical.key).toBe('string');

    // Semantic Check (Gemini)
    expect(profile.semantic).toBeDefined();
    expect(profile.semantic.mood.length).toBeGreaterThan(0);
    expect(profile.semantic.targetPrompts.imagen).toBeTruthy();
    expect(profile.semantic.targetPrompts.veo).toBeTruthy();

    // Provenance Check
    expect(profile.modelVersion).toContain('preview'); // gemini-3...
});
