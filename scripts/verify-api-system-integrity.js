import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RENDERER_SRC = path.join(ROOT_DIR, 'packages', 'renderer', 'src');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let hasErrors = false;

// 1. Ghost Test Sweeper
console.log(`${YELLOW}Scanning for duplicate "Ghost" test files...${RESET}`);
const testFiles = new Map(); // basename -> Set of absolute paths

function scanForTests(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // Ignore node_modules, dist, .agent
        if (entry.isDirectory() && !['node_modules', 'dist', '.agent'].includes(entry.name)) {
            scanForTests(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx'))) {
            if (!testFiles.has(entry.name)) {
                testFiles.set(entry.name, new Set());
            }
            testFiles.get(entry.name).add(fullPath);
        }
    }
}

scanForTests(RENDERER_SRC);

let duplicateCount = 0;
for (const [basename, paths] of testFiles.entries()) {
    if (paths.size > 1) {
        hasErrors = true;
        duplicateCount++;
        console.error(`${RED}❌ Duplicate test files found for: ${basename}${RESET}`);
        for (const p of paths) {
            console.error(`   - ${p.replace(ROOT_DIR, '')}`);
        }
    }
}
if (duplicateCount === 0) {
    console.log(`${GREEN}✓ No ghost tests found.${RESET}`);
} else {
    console.log(`${RED}Please delete the identical redundant files to prevent Vitest ghost failures.${RESET}\n`);
}

// 2. Legacy API Scanner
console.log(`${YELLOW}Scanning for legacy browser AI dependencies...${RESET}`);

const BANNED_PATTERNS = [
    { pattern: 'DirectImageEditor', message: 'Legacy DirectImageEditor logic is deprecated. Route through httpsCallable secure proxy.' },
    { pattern: 'FallbackClient', message: 'FallbackClient is deprecated.' },
];

function scanForLegacyCode(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanForLegacyCode(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // Check for explicit VITE_API_KEY usage (banned outside of tests/stubs)
            if (!entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
                if (content.includes('VITE_API_KEY') && !content.includes('// eslint-disable-next-line')) {
                    // We allow it in env declarations/config, but not active use. Let's just flag it aggressively.
                    if (!fullPath.includes('env.d.ts') && !fullPath.includes('config/')) {
                        console.error(`${RED}❌ VITE_API_KEY detected in browser code: ${fullPath.replace(ROOT_DIR, '')}${RESET}`);
                        console.error(`   - Never use raw API keys in the client. Route through Cloud Functions.`);
                        hasErrors = true;
                    }
                }
            }

            // Check for banned classes
            for (const banned of BANNED_PATTERNS) {
                if (content.includes(banned.pattern)) {
                    console.error(`${RED}❌ Banned pattern '${banned.pattern}' found in: ${fullPath.replace(ROOT_DIR, '')}${RESET}`);
                    console.error(`   - ${banned.message}`);
                    hasErrors = true;
                }
            }
        }
    }
}

if (fs.existsSync(RENDERER_SRC)) {
    scanForLegacyCode(RENDERER_SRC);
} else {
    console.log(`${YELLOW}Skipping legacy code scan (renderer/src not found)${RESET}`);
}

if (hasErrors) {
    console.error(`\n${RED}API SYSTEM INTEGRITY CHECK FAILED.${RESET}`);
    console.error(`${RED}The build has been halted to prevent structural regression.${RESET}`);
    process.exit(1);
} else {
    console.log(`\n${GREEN}✓ API System Integrity Check Passed. Ready for CI.${RESET}`);
    process.exit(0);
}
