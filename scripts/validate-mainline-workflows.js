import fs from 'fs';
import path from 'path';
import process from 'process';

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, '.agent', 'workflows');
const gateLine =
  '> **Mainline delivery gate:** Read [`branch-safety.md`](branch-safety.md) before code, git, or CI actions. It defines delivery through Entire, including the automatic Trail route for protected `main`.';

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
    if (line.includes('git push')) {
      failures.push(`${name}:${index + 1}: route push instructions through branch-safety.md`);
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

const canonicalAgentInstructions = fs.readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
const sharedPolicyLink = '](.agent/workflows/branch-safety.md)';
for (const [name, content] of [['AGENTS.md', agents], ['CLAUDE.md', canonicalAgentInstructions]]) {
  if (!content.includes(sharedPolicyLink)) {
    failures.push(`${name}: missing link to the shared delivery policy`);
  }
}
for (const name of ['CODEX.md', 'GEMINI.md', 'ANTIGRAVITY.md']) {
  if (fs.readFileSync(path.join(repoRoot, name), 'utf8') !== canonicalAgentInstructions) {
    failures.push(`${name}: agent instructions must match CLAUDE.md`);
  }
}

const monitor = fs.readFileSync(path.join(repoRoot, 'scripts', 'git_monitor_sync.js'), 'utf8');
// Match the explicit direct-to-main push whether or not the call carries
// extra options (e.g. timeout args): `runCommand('git push origin HEAD:main')`
// or `runCommand('git push origin HEAD:main', false, TIMEOUTS.pushMs)`.
if (!/runCommand\('git push origin HEAD:main'(?:,|\s*\))/.test(monitor)) {
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
