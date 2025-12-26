
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

function checkFileContains(filePath: string, searchStrings: string[]) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    try {
        if (!fs.existsSync(fullPath)) {
            console.error(`[ERROR] File not found: ${filePath}`);
            return false;
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        const missing = searchStrings.filter(s => !content.includes(s));
        if (missing.length > 0) {
            console.error(`[FAIL] ${filePath} missing:`);
            missing.forEach(s => console.error(`  - "${s}"`));
            return false;
        }
        console.log(`[PASS] ${filePath}`);
        return true;
    } catch (e: any) {
        console.error(`[ERROR] Could not read ${filePath}: ${e.message}`);
        return false;
    }
}

function checkFileNotContains(filePath: string, searchStrings: string[]) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    try {
        if (!fs.existsSync(fullPath)) {
            return true; // File doesn't exist, so it doesn't contain the string
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        const found = searchStrings.filter(s => content.includes(s));
        if (found.length > 0) {
            console.error(`[FAIL] ${filePath} contains forbidden strings:`);
            found.forEach(s => console.error(`  - "${s}"`));
            return false;
        }
        console.log(`[PASS] ${filePath} (clean)`);
        return true;
    } catch (e: any) {
        console.error(`[ERROR] Could not read ${filePath}: ${e.message}`);
        return false;
    }
}

function verify() {
    console.log("Starting Static Verification...");
    let passed = true;

    // 1. Verify Rebranding (Positive Checks)
    passed = checkFileContains('src/services/agent/AgentService.ts', [
        'You are indii, the Autonomous Studio Manager',
        'You are indii, Senior Architectural Visualizer',
        'You are indii, Digital Fashion Stylist',
        'You are indii, Creative Director'
    ]) && passed;

    passed = checkFileContains('src/modules/creative/components/CreativeNavbar.tsx', [
        'indii'
    ]) && passed;

    passed = checkFileContains('src/core/components/AgentWindow.tsx', [
        'const windowTitle = title || "indii";',
        'indii'
    ]) && passed;

    // 2. Verify Rebranding (Negative Checks - Ensure "Agent R" is gone)
    const filesToCheck = [
        'src/services/agent/AgentService.ts',
        'src/modules/creative/components/CreativeNavbar.tsx',
        'src/core/components/AgentWindow.tsx',
        'src/services/agent/specialists/BaseAgent.ts',
        'src/services/agent/specialists/LegalAgent.ts',
        'src/services/agent/specialists/MarketingAgent.ts',
        'src/services/agent/specialists/MusicAgent.ts'
    ];

    filesToCheck.forEach(file => {
        passed = checkFileNotContains(file, ['Agent R']) && passed;
    });

    // 3. Verify Genkit Tools
    passed = checkFileContains('src/services/agent/tools.ts', [
        'generate_video:',
        'generate_motion_brush:',
        'analyze_audio:',
        'Video.generateVideo',
        'Video.generateMotionBrush',
        'AudioAnalysisEngine'
    ]) && passed;

    // 4. Verify Audio Engine Refactor
    passed = checkFileContains('src/modules/music/services/AudioAnalysisEngine.ts', [
        'async analyze(input: File | ArrayBuffer)',
        'if (input instanceof File)'
    ]) && passed;

    // 5. Verify Multi-Agent Architecture
    passed = checkFileContains('src/services/agent/registry.ts', [
        'export class AgentRegistry',
        'register(agent: SpecializedAgent)'
    ]) && passed;

    if (passed) {
        console.log("\nAll Static Checks Passed!");
    } else {
        console.error("\nVerification Failed.");
        process.exit(1);
    }
}

verify();
