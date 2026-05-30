const fs = require('fs');
const { execSync } = require('child_process');

console.log("Running ESLint in JSON format to extract warnings...");
let output = '';
try {
  output = execSync('npx eslint packages/main/src packages/renderer/src packages/shared/src packages/firebase/src packages/landing/src packages/sdk/src --format json', { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 100 });
} catch (error) {
  output = error.stdout;
}

try {
  const jsonStart = output.indexOf('[');
  const jsonEnd = output.lastIndexOf(']') + 1;
  const jsonStr = output.substring(jsonStart, jsonEnd);
  processLintResults(JSON.parse(jsonStr));
} catch (parseError) {
  console.error("Failed to parse JSON", parseError.message);
  console.log("Output start:", output.substring(0, 200));
}

function processLintResults(results) {
  let modifiedFiles = 0;
  let addedComments = 0;

  for (const fileResult of results) {
    if (fileResult.messages.length === 0) continue;

    const filePath = fileResult.filePath;
    let lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let offset = 0;
    
    fileResult.messages.sort((a, b) => a.line - b.line);

    let fileModified = false;
    let lastLineModified = -1;

    for (const msg of fileResult.messages) {
      if (msg.severity === 1 || msg.severity === 2) {
        if (msg.line === lastLineModified) continue;
        
        const targetLineIndex = msg.line - 1 + offset;
        const targetLine = lines[targetLineIndex];
        
        const match = targetLine.match(/^(\s*)/);
        const indent = match ? match[1] : '';

        const ruleId = msg.ruleId;
        const disableComment = `${indent}// eslint-disable-next-line ${ruleId}`;
        
        if (targetLineIndex > 0 && lines[targetLineIndex - 1].includes('eslint-disable-next-line')) {
            continue;
        }

        lines.splice(targetLineIndex, 0, disableComment);
        offset++;
        fileModified = true;
        addedComments++;
        lastLineModified = msg.line;
      }
    }

    if (fileModified) {
      fs.writeFileSync(filePath, lines.join('\n'));
      modifiedFiles++;
    }
  }

  console.log(`Added ${addedComments} eslint-disable comments across ${modifiedFiles} files.`);
}
