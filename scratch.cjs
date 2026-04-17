const { readFileSync } = require('fs');

const file = readFileSync('packages/renderer/src/utils/security.ts', 'utf8');
console.log(file.includes('if (!crypto || !crypto.getRandomValues) {'));
