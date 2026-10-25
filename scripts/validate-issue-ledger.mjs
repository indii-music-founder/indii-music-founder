#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { validateIssueLedger } from './issue-ledger-integrity.mjs';

const path = '.agent/test_ledger/OPEN_ISSUES_V3.md';
const baseRef = process.argv[2] ?? 'HEAD';
const staged = process.argv[3] === '--staged';
if (!/^[A-Za-z0-9_./^~-]+$/.test(baseRef) || baseRef.startsWith('-')) {
  throw new Error('Invalid base ref.');
}
const show = revision => execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' });
const base = show(baseRef);
const candidate = staged ? show('') : readFileSync(path, 'utf8');
const failures = validateIssueLedger(base, candidate);
if (failures.length) {
  console.error('Issue ledger integrity check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Issue ledger findings, identifiers, and closure evidence preserved.');
}
