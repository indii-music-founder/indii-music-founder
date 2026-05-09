import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASETS_DIR = path.join(__dirname, '../../docs/agent-training/datasets');

async function auditRates() {
    console.log('🔍 Starting Mechanical Rate Audit (May 2026 Refresh)');
    console.log('   Target: Replace $0.091 (legacy) with $0.0946 (current)');

    const files = fs.readdirSync(DATASETS_DIR).filter(f => f.endsWith('.jsonl'));
    let totalFixes = 0;

    for (const file of files) {
        const filePath = path.join(DATASETS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Match 0.091 with or without $ sign
        const legacyPattern = /(\$?)0\.091\b/g;
        const matches = content.match(legacyPattern);

        if (matches) {
            console.log(`\n📄 ${file}: Found ${matches.length} legacy rate references.`);
            const updatedContent = content.replace(legacyPattern, '$10.0946');
            fs.writeFileSync(filePath, updatedContent);
            totalFixes += matches.length;
            console.log(`   ✅ Fixed.`);
        }
    }

    console.log(`\n✨ Audit Complete. Total legacy rate references updated: ${totalFixes}`);
}

auditRates().catch(console.error);
