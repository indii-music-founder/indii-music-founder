const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'packages/renderer/src/services/rag/GeminiRetrievalService.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const response = await fetch\(url, \{/g,
    `console.log('--- RAG FETCH ---', url, headers);\n                const response = await fetch(url, {`
);

fs.writeFileSync(file, content);
console.log('Patched logging in fetch.');
