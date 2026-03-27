const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                if (!file.includes('.test.') && !file.includes('__tests__') && !file.includes('e2e/')) {
                    results.push(file);
                }
            }
        }
    });
    return results;
}
const files = walk('./src');
let total = 0;
files.forEach(f => {
    const content = fs.readFileSync(f, 'utf-8');
    let lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('as any')) {
            console.log(f + ':' + (i + 1));
            total++;
        }
    });
});
console.log('Total:', total);
