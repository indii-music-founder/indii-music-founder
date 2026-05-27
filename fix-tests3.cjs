const fs = require('fs');
const path = require('path');

const allTestFiles = [
    'LensVeoAspectRatio.test.ts',
    'VeoIntegration.test.ts',
    'VideoGenerationService.integration.test.ts',
    'VideoGenerationService.ledger.test.ts',
    'VideoGenerationService.schema.test.ts',
    'VideoGenerationService.test.ts',
    'LensVideoVerification.test.ts'
];

const basePath = path.join(__dirname, 'packages/renderer/src/services/video');

for (const file of allTestFiles) {
    const filePath = path.join(basePath, file);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Make sure we mock uploadString from firebase/storage
    if (content.includes("vi.mock('firebase/storage'")) {
        // Find vi.mock('firebase/storage', () => ({ ... })) and add uploadString if missing
        if (!content.includes("uploadString:")) {
            content = content.replace(/vi\.mock\('firebase\/storage', \(\) => \(\{/, "vi.mock('firebase/storage', () => ({\n    uploadString: vi.fn().mockResolvedValue({}),");
        }
    }

    // In these files, they were expecting mocks.firebaseAI.generateVideo to be called.
    // Let's replace expect(mocks.firebaseAI.generateVideo) with expect(mocks.httpsCallableFn)
    if (content.includes("expect(mocks.firebaseAI.generateVideo)")) {
        content = content.replace(/mocks\.firebaseAI\.generateVideo/g, "mocks.httpsCallableFn");
    }
    
    // Also add httpsCallableFn to mocks object
    if (content.includes("const mocks = vi.hoisted(() => ({") && !content.includes("httpsCallableFn:")) {
        content = content.replace(/const mocks = vi\.hoisted\(\(\) => \(\{/, "const mocks = vi.hoisted(() => ({\n    httpsCallableFn: vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } }),");
    }
    
    // Update httpsCallable mock to return mocks.httpsCallableFn
    content = content.replace(/httpsCallable:\s*vi\.fn\([^\)]*\)/g, "httpsCallable: vi.fn(() => mocks.httpsCallableFn)");

    // Fix Quota error text in VideoGenerationService.test.ts and ledger
    if (content.includes("'Quota exceeded: Quota exceeded'")) {
        content = content.replace(/'Quota exceeded: Quota exceeded'/g, "'Quota exceeded: video_duration. Quota exceeded'");
    }
    if (content.includes("'Quota exceeded: Circuit Breaker Active: Monthly limit reached.'")) {
        content = content.replace(/'Quota exceeded: Circuit Breaker Active: Monthly limit reached.'/g, "'Quota exceeded: video_duration. Circuit Breaker Active: Monthly limit reached.'");
    }

    fs.writeFileSync(filePath, content);
}

