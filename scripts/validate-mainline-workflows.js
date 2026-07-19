import fs from 'fs';
import path from 'path';
import process from 'process';

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, '.agent', 'workflows');
const gateLine =
  '> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.';

const workflowFiles = fs
  .readdirSync(workflowsDir)
  .filter((name) => name.endsWith('.md') && name !== 'branch-safety.md')
  .sort();

const forbidden = [
  ['automatic branch creation', /git (?:checkout -b|switch -c)/],
  ['history-rewriting pull', /git pull --rebase/],
  ['force push', /git push[^\n]*--force/],
  ['catch-all staging', /git add -A/],
  ['automatic PR creation', /\bopen a PR\b/i],
  ['automatic branch merge', /\bmerge the active branch\b/i],
  ['feature-branch mandate', /\bUse Feature Branches\b/i]
];

const failures = [];

for (const name of workflowFiles) {
  const filePath = path.join(workflowsDir, name);
  const contents = fs.readFileSync(filePath, 'utf8');

  if (!contents.includes(gateLine)) {
    failures.push(`${name}: missing mandatory mainline delivery gate`);
  }

  for (const [label, pattern] of forbidden) {
    if (pattern.test(contents)) {
      failures.push(`${name}: contains forbidden ${label}`);
    }
  }

  for (const [index, line] of contents.split('\n').entries()) {
    if (line.includes('git push') && !line.includes('git push origin HEAD:main')) {
      failures.push(`${name}:${index + 1}: ambiguous or non-main push instruction`);
    }
  }
}

const checkpointPath = path.join(repoRoot, '.claude', 'scripts', 'checkpoint.sh');
const checkpoint = fs.readFileSync(checkpointPath, 'utf8');
for (const pattern of [/^\s*git add\b/m, /^\s*git commit\b/m, /^\s*git push\b/m]) {
  if (pattern.test(checkpoint)) {
    failures.push('checkpoint.sh: Stop hook must never stage, commit, or push');
  }
}

const agents = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
if (!agents.includes('## Mainline Delivery Standard')) {
  failures.push('AGENTS.md: missing Mainline Delivery Standard');
}

const monitor = fs.readFileSync(path.join(repoRoot, 'scripts', 'git_monitor_sync.js'), 'utf8');
if (!monitor.includes("runCommand('git push origin HEAD:main')")) {
  failures.push('git_monitor_sync.js: missing explicit direct-to-main push');
}
if (/git pull --rebase|git push origin \$\{branchName\}/.test(monitor)) {
  failures.push('git_monitor_sync.js: contains legacy branch/rebase behavior');
}

if (failures.length > 0) {
  console.error('Mainline workflow policy validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Mainline workflow policy valid across ${workflowFiles.length} slash workflows.`);
