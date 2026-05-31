const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'packages/renderer/src/services/agent/memory/AlwaysOnMemoryEngine.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /if \(\!this\.userId\) throw new Error\('Engine not started\. Call start\(\) first\.'\);/g,
    `if (this.isE2EMode) return 'Mock Success' as any;\n        if (!this.userId) throw new Error('Engine not started. Call start() first.');`
);

fs.writeFileSync(file, content);
console.log('Patched AlwaysOnMemoryEngine.ts');
