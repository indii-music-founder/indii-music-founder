#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseIssueLedger, validateIssueLedger } from './issue-ledger-integrity.mjs';
import { classifyIssueStatus } from './issue-ledger-inventory.mjs';
import { ACTIVE_LEDGER, RETIRED_LEDGERS, SEALED_ARCHIVES } from './issue-ledger-config.mjs';

const baseRef = process.argv[2] ?? 'HEAD';
const staged = process.argv[3] === '--staged';
if (!/^[A-Za-z0-9_./^~-]+$/.test(baseRef) || baseRef.startsWith('-')) {
  throw new Error('Invalid base ref.');
}
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
// Returns null when the file does not exist at that revision ('' = the index).
const show = (revision, path) => {
  try { git(['cat-file', '-e', `${revision}:${path}`]); } catch { return null; }
  return git(['show', `${revision}:${path}`]);
};
const candidateOf = path => staged ? show('', path)
  : (existsSync(path) ? readFileSync(path, 'utf8') : null);

const failures = [];
const activeBase = show(baseRef, ACTIVE_LEDGER) ?? '';
const activeCandidate = candidateOf(ACTIVE_LEDGER) ?? '';
failures.push(...validateIssueLedger(activeBase, activeCandidate));

for (const { path, archive } of RETIRED_LEDGERS) {
  const base = show(baseRef, path);
  const retiredNow = candidateOf(path);
  if (retiredNow !== null && parseIssueLedger(retiredNow).length > 0 &&
      parseIssueLedger(base ?? '').length === 0) {
    failures.push(`${path}: retired ledger must not hold numbered findings; write to ${ACTIVE_LEDGER}.`);
  }
  const baseFindings = parseIssueLedger(base ?? '');
  if (baseFindings.length === 0 || (retiredNow !== null && parseIssueLedger(retiredNow).length > 0)) continue;
  // Retiring a ledger: archive must keep every finding, active must carry every open one.
  failures.push(...validateIssueLedger(base, candidateOf(archive) ?? '').map(f => `${archive}: ${f}`));
  const active = new Set(parseIssueLedger(activeCandidate).map(i => `${i.id}\u0000${i.title}`));
  for (const issue of baseFindings) {
    if (classifyIssueStatus(issue.status) !== 'terminal' && !active.has(`${issue.id}\u0000${issue.title}`)) {
      failures.push(`ISSUE-${issue.id}: open finding not carried into ${ACTIVE_LEDGER}.`);
    }
  }
}

for (const archive of SEALED_ARCHIVES) {
  const base = show(baseRef, archive);
  if (base !== null && base !== candidateOf(archive)) failures.push(`${archive}: sealed archive modified.`);
}

if (failures.length) {
  console.error('Issue ledger integrity check failed:');
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Issue ledger findings, identifiers, and closure evidence preserved.');
}
