const fs = require('fs');
const glob = require('glob');

const rendererFiles = glob.sync('packages/renderer/src/**/*.{ts,tsx}', { ignore: ['**/*.test.*', '**/__tests__/**', '**/core/logger/**', '**/utils/logger.ts', '**/env.ts'] });
const mainFiles = glob.sync('packages/main/src/**/*.{ts,tsx}', { ignore: ['**/*.test.*', '**/__tests__/**', '**/main.ts', '**/HistoryStore.resilience.test.ts'] });

const allFiles = [...rendererFiles, ...mainFiles];

let totalRemoved = 0;

for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = '';
    let i = 0;
    let fileChanged = false;

    while (i < content.length) {
        // Look for console.log/warn/error/info
        const match = content.slice(i).match(/^console\.(log|warn|error|info)\s*\(/);
        if (match) {
            fileChanged = true;
            totalRemoved++;
            // We found the start of a console call
            let start = i;
            i += match[0].length;
            let parenCount = 1;
            let insideString = null;
            let escape = false;

            while (i < content.length && parenCount > 0) {
                const char = content[i];
                if (escape) {
                    escape = false;
                } else if (char === '\\') {
                    escape = true;
                } else if (insideString) {
                    if (char === insideString) {
                        insideString = null;
                    }
                } else if (char === '"' || char === "'" || char === '`') {
                    insideString = char;
                } else if (char === '(') {
                    parenCount++;
                } else if (char === ')') {
                    parenCount--;
                }
                i++;
            }
            
            // Replace the entire call with void 0
            newContent += 'void 0';
        } else {
            newContent += content[i];
            i++;
        }
    }

    if (fileChanged) {
        fs.writeFileSync(file, newContent);
        console.log(`Updated ${file}`);
    }
}

console.log(`Total console statements removed: ${totalRemoved}`);
