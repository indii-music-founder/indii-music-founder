import { readFileSync } from 'node:fs';
const workflow = readFileSync('.github/workflows/weekly-demo-audit.yml', 'utf8');
if (!workflow.includes('shell: bash -euo pipefail {0}')) throw new Error('Weekly audit must use pipefail.');
for (const command of ['npm ci', 'npm run typecheck', 'npm run lint', 'npm run test:ci', 'npm run build']) {
  const index = workflow.indexOf(`${command} 2>&1 | tee`);
  const block = workflow.slice(index, index + 350);
  if (index === -1 || !block.includes('code=${PIPESTATUS[0]}') || !block.includes('exit "$code"')) throw new Error(`Exit code is masked: ${command}`);
}
if (/outputs\.exit_code\s*==\s*'success'/.test(workflow)) {
  throw new Error('Weekly audit must compare numeric exit-code outputs to 0, not a step outcome.');
}
for (const expression of ['require("ffmpeg-static")', 'require("ffprobe-static").path']) {
  if (!workflow.includes(`node -p '${expression}'`)) {
    throw new Error(`Weekly audit must resolve ${expression} with shell-safe quoting.`);
  }
}
console.log('Verified weekly audit pipeline failure propagation.');
