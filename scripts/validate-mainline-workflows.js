import fs from 'fs';
import path from 'path';
import process from 'process';

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, '.agent', 'workflows');
const gateLine =
  '> **Protected main delivery gate:** Before any code, git, CI, or push action, read and obey [`branch-safety.md`](branch-safety.md). Deliver through a focused branch and reviewed PR; direct pushes to `main` are prohibited.';

const workflowFiles = fs
  .readdirSync(workflowsDir)
  .filter((name) => name.endsWith('.md') && name !== 'branch-safety.md')
  .sort();

const forbidden = [
  ['history-rewriting pull', /git pull --rebase/],
  ['force push', /git push[^\n]*--force/],
  ['catch-all staging', /git add -A/],
  ['direct main push', /git push origin HEAD:main/],
  ['direct-main mandate', /Direct-to-`main` is mandatory/]
];

const failures = [];

for (const name of workflowFiles) {
  const filePath = path.join(workflowsDir, name);
  const contents = fs.readFileSync(filePath, 'utf8');

  if (!contents.includes(gateLine)) {
    failures.push(`${name}: missing protected-main delivery gate`);
  }

  for (const [label, pattern] of forbidden) {
    if (pattern.test(contents)) {
      failures.push(`${name}: contains forbidden ${label}`);
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
if (!agents.includes('## Protected Main Delivery Standard')) {
  failures.push('AGENTS.md: missing Protected Main Delivery Standard');
}

const monitor = fs.readFileSync(path.join(repoRoot, 'scripts', 'git_monitor_sync.js'), 'utf8');
if (/runCommand\(['"]git (?:push|merge|reset)/.test(monitor)) {
  failures.push('git_monitor_sync.js: monitor must remain read-only');
}
if (/git pull --rebase|git push origin \$\{branchName\}/.test(monitor)) {
  failures.push('git_monitor_sync.js: contains legacy branch/rebase behavior');
}

if (failures.length > 0) {
  console.error('Protected-main workflow policy validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Protected-main workflow policy valid across ${workflowFiles.length} slash workflows.`);
