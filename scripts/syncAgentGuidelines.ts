
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
// We are in /scripts/, so .docs is at ../.docs
const DOCS_JSON = path.resolve(__dirname, '../.docs/agent_guidelines.json');
// We want to sync to src/core/agent-guidelines.json
const CORE_JSON = path.resolve(__dirname, '../src/core/agent-guidelines.json');

// User requested syncing to specific agent folders in src/agents/
const AGENT_DIRS = [
    'Orchestrator',
    'Gemini',
    'Claude',
    'Jules'
];

export function syncAllAgents() {
    console.log('🔄 Syncing Agent Guidelines...');

    try {
        // 1. Read source
        if (!fs.existsSync(DOCS_JSON)) {
            throw new Error(`Source file not found: ${DOCS_JSON}`);
        }
        const sourceData = fs.readFileSync(DOCS_JSON, 'utf-8');
        const json = JSON.parse(sourceData);

        // 2. Simple validation
        if (!json.version || !json.agents) {
            throw new Error('Invalid agent_guidelines.json structure');
        }

        // 3. Write to core
        const coreDir = path.dirname(CORE_JSON);
        if (!fs.existsSync(coreDir)) {
            fs.mkdirSync(coreDir, { recursive: true });
        }
        fs.writeFileSync(CORE_JSON, sourceData, 'utf-8');
        console.log(`✅ Synced version ${json.version} to src/core/agent-guidelines.json`);

        // 4. Write to individual agent folders
        AGENT_DIRS.forEach(agentName => {
            const agentDir = path.resolve(__dirname, `../src/agents/${agentName}`);
            // Ensure directory exists
            if (!fs.existsSync(agentDir)) {
                fs.mkdirSync(agentDir, { recursive: true });
            }
            const agentFile = path.join(agentDir, 'agent-guidelines.json');
            fs.writeFileSync(agentFile, sourceData, 'utf-8');
            console.log(`✅ Synced to src/agents/${agentName}/agent-guidelines.json`);
        });

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

// Auto-run if executed directly
// Auto-run if executed directly (works with both .ts and compiled .js)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('syncAgentGuidelines.ts')) {
    syncAllAgents();
}
}
if (process.argv[1] === __filename) {
    syncAllAgents();
}
