const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('bg-gradient-to')) {
                // Tailwind v4 migration
                content = content.replace(/bg-gradient-to-([b|t|r|l]|tr|tl|br|bl)\b/g, 'bg-linear-to-$1');
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Replaced in ${fullPath}`);
            }
        }
    }
}

replaceInDir(path.resolve(__dirname, '../packages/renderer/src'));
console.log('Done');
