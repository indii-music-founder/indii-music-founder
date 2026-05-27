const fs = require('fs');
const path = require('path');

const testFiles = [
    'LensVeoResilience.test.ts',
    'VeoIntegration.test.ts',
    'VideoGenerationService.integration.test.ts',
    'VideoGenerationService.ledger.test.ts',
    'VideoGenerationService.schema.test.ts',
    'VideoGenerationService.test.ts',
    'LensVideoVerification.test.ts'
];

const basePath = path.join(__dirname, 'packages/renderer/src/services/video');

for (const file of testFiles) {
    const filePath = path.join(basePath, file);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Add getCurrentSubscription to subscriptionService mock
    content = content.replace(/subscriptionService: \{([^}]*)\}/s, (match, p1) => {
        if (!p1.includes('getCurrentSubscription')) {
            return `subscriptionService: {${p1},\n        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' })\n    }`;
        }
        return match;
    });

    // Update httpsCallable mock to return a mock function
    content = content.replace(/httpsCallable:\s*vi\.fn\(\(\)\s*=>\s*vi\.fn\(\)\),/g, `httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } })),`);
    // Wait, in LensVeoResilience it's vi.fn(() => vi.fn())
    
    // Replace mocks.generateVideo assertions with mockHttpsCallable assertions
    // Actually, we can export the mockHttpsCallableFn to be used
    if (content.includes('mocks.generateVideo')) {
        content = content.replace(/mocks\.generateVideo/g, "mocks.httpsCallableFn");
        content = content.replace(/const mocks = vi\.hoisted\(\(\) => \(\{/, "const mocks = vi.hoisted(() => ({\n    httpsCallableFn: vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } }),");
        content = content.replace(/httpsCallable:\s*vi\.fn\([^\)]*\)/g, "httpsCallable: vi.fn(() => mocks.httpsCallableFn)");
    }

    fs.writeFileSync(filePath, content);
}

// Fix CreativeStorageService issue in VeoIntegration.test.ts
// The error was TypeError: Cannot read properties of undefined (reading 'options') in uploadReferenceMedia
// Let's check what CreativeStorageService imports from firebase/storage in its mock
