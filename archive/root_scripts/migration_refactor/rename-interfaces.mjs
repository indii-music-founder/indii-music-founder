import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    if (content.includes('IDistributorAdapter')) {
        content = content.replace(/IDistributorAdapter/g, 'DistributorAdapter');
        modified = true;
    }
    if (content.includes('IAgentRegistry')) {
        content = content.replace(/IAgentRegistry/g, 'AgentRegistryProvider');
        modified = true;
    }
    if (content.includes('IPODProvider')) {
        content = content.replace(/IPODProvider/g, 'PODProviderAdapter');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function walkDir(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) { return; }

    files.forEach(file => {
        if (file === '.DS_Store' || file === 'node_modules' || file === 'dist' || file.startsWith('.')) return;
        const filepath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(filepath);
        } catch (e) { return; }

        if (stat.isDirectory()) walkDir(filepath);
        else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            replaceInFile(filepath);
        }
    });
}

walkDir(path.join(__dirname, 'src'));
