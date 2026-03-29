import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walkDir(dir, callback) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }

    files.forEach(file => {
        if (file === '.DS_Store' || file === 'node_modules' || file === 'dist' || file.startsWith('.')) return;

        const filepath = path.join(dir, file);
        let stats;
        try {
            stats = fs.statSync(filepath);
        } catch (e) {
            return;
        }

        if (stats.isDirectory()) {
            walkDir(filepath, callback);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            callback(filepath);
        }
    });
}

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    // Step 1: ensure `catch (e)` or `catch (err)` has `: unknown`
    // Wait, the previous task added `: unknown`.
    // Let's just look for catch blocks that don't have Error handling.
    // Given the complexity of AST parsing via Regex, and the fact that we fixed the `: unknown` globally in previous steps (or didn't?),
    // The previous run added `: unknown` to a lot of things.
    // The issue says: ">140 occurrences of bare catch (e) without instanceof Error validation, resulting in implicit unknown coercions that can cause crashes if e.message is accessed."

    // Instead of regex replacing everything blindly, let's just create a more robust regex string.

    const catchRegex = /catch\s*\(\s*([a-zA-Z0-9_]+)\s*(:\s*any\s*|:\s*unknown\s*)?\)/g;
    content = content.replace(catchRegex, (match, p1) => {
        modified = true;
        return `catch (${p1}: unknown)`;
    });

    if (modified) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated: ${filepath}`);
    }
}

walkDir(path.join(__dirname, 'src'), processFile);
