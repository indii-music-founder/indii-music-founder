const fs = require('fs');
const path = require('path');

const videoTestFiles = [
    'LensVeoResilience.test.ts',
    'VeoIntegration.test.ts',
    'VideoGenerationService.integration.test.ts',
    'VideoGenerationService.ledger.test.ts',
    'VideoGenerationService.schema.test.ts',
    'VideoGenerationService.test.ts',
    'LensVideoVerification.test.ts'
];

const imageTestFiles = [
    'ImageGenerationService.test.ts'
];

function fixFirebaseMock(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Fix storage mock to include app.options.storageBucket
    content = content.replace(/storage:\s*\{[^}]*\}/, "storage: { app: { options: { storageBucket: 'mock-bucket' } } }");
    if (!content.includes("storage: { app: { options:")) {
        // If it was just storage: {}
        content = content.replace(/storage:\s*\{/, "storage: { app: { options: { storageBucket: 'mock-bucket' } } ");
    }

    // Replace vi.mock('firebase/storage') if present or add if missing
    if (content.includes("vi.mock('firebase/storage'")) {
        content = content.replace(/vi\.mock\('firebase\/storage', \(\) => \(\{/, "vi.mock('firebase/storage', () => ({\n    uploadString: vi.fn().mockResolvedValue({}),");
    }

    fs.writeFileSync(filePath, content);
}

for (const file of videoTestFiles) {
    fixFirebaseMock(path.join(__dirname, 'packages/renderer/src/services/video', file));
}

for (const file of imageTestFiles) {
    fixFirebaseMock(path.join(__dirname, 'packages/renderer/src/services/image/__tests__', file));
}

