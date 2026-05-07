const fs = require('fs');
const file = 'packages/renderer/src/core/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const lazyHelper = `
// Helper to automatically retry lazy-loaded chunks if network fails
const lazyWithRetry = (componentImport: () => Promise<any>) => {
    return lazy(async () => {
        let retries = 3;
        let interval = 500;
        while (retries > 0) {
            try {
                return await componentImport();
            } catch (error: any) {
                if (error.message && error.message.includes('Failed to fetch dynamically imported module')) {
                    retries--;
                    if (retries === 0) throw error;
                    await new Promise(resolve => setTimeout(resolve, interval));
                    interval *= 1.5;
                } else {
                    throw error;
                }
            }
        }
        return await componentImport(); // Should not reach here
    });
};

`;

content = content.replace('// ============================================================================\n// Lazy-loaded Module Components\n// ============================================================================', '// ============================================================================\n// Lazy-loaded Module Components\n// ============================================================================\n' + lazyHelper);

content = content.replace(/const ([a-zA-Z0-9_]+) = lazy\(/g, 'const $1 = lazyWithRetry(');
fs.writeFileSync(file, content);
console.log('App.tsx patched');
