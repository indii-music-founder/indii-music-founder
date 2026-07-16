const fs = require('fs');

const files = [
    'packages/main/src/handlers/scheduler.ts',
    'packages/main/src/handlers/daw.ts',
    'packages/main/src/handlers/mobile_remote.ts',
    'packages/main/src/main.ts',
    'packages/main/src/updater.ts'
];

for (const file of files) {
    if (!fs.existsSync(file)) {
        console.log(`Skipping missing file: ${file}`);
        continue;
    }
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Add import if not present
    if (!content.includes('import { validateSender }')) {
        let importPath = '../utils/ipc-security';
        if (file === 'packages/main/src/main.ts' || file === 'packages/main/src/updater.ts') {
            importPath = './utils/ipc-security';
        }
        content = `import { validateSender } from '${importPath}';\n` + content;
        changed = true;
    }

    // Replace ipcMain.handle(..., () => { ... })
    // Regex to match ipcMain.handle callback opening
    // We capture event param if present, or add it if not
    const regex = /ipcMain\.handle\([^,]+,\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{/g;
    content = content.replace(regex, (match, asyncStr, params) => {
        let newParams = params;
        let pList = params.split(',').map(p => p.trim());
        if (pList.length === 0 || pList[0] === '') {
            newParams = 'event';
        } else if (pList[0].startsWith('_event')) {
            newParams = pList.join(', ').replace('_event', 'event');
        } else if (pList[0] !== 'event') {
            newParams = pList.join(', '); // Might already be event
        }
        
        const returnStr = `ipcMain.handle(${match.split(',')[0].split('(')[1]}, ${asyncStr || ''}(${newParams}) => {\n        validateSender(event);`;
        if (match.includes('validateSender')) return match;
        changed = true;
        return returnStr;
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
}
