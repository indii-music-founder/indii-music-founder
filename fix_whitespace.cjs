const fs = require('fs');
const file = 'packages/renderer/src/services/agent/definitions/SecurityAgent.ts';
let content = fs.readFileSync(file, 'utf8');

const oldPrompt = `            const prompt = \`Scan the following text for PII (Personally Identifiable Information), offensive content, or security secrets.
            Text: \${args.text}
            
            Return a JSON object with: isSafe (boolean), issues (array of strings), redacted_text (string).\`;`;

const newPrompt = `            const prompt = \`Scan the following text for PII (Personally Identifiable Information), offensive content, or security secrets.
            Text: \${args.text}
            
            Return a JSON object with: isSafe (boolean), issues (array of strings), redacted_text (string).\`.replace(/^\\s+/gm, '');`;

if (content.includes(oldPrompt)) {
    content = content.replace(oldPrompt, newPrompt);
    fs.writeFileSync(file, content);
    console.log("Fixed whitespace bloat");
} else {
    console.log("Could not find prompt");
}
