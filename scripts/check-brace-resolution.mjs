#!/usr/bin/env node
/** ISSUE-1514: validate actual brace-expansion copies and Wireit's required major. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'package-lock.json'), 'utf8'));
const copies = Object.entries(lock.packages ?? {}).filter(([path]) => path.endsWith('node_modules/brace-expansion'));
// Reviewed patched lines: 2.1.7 and 5.0.12 (including GHSA-q2hr-2g5m-vwhr).
const approved = new Set(['2.1.7', '5.0.12']);
const errors = copies.filter(([, value]) => !approved.has(value.version))
  .map(([path, value]) => `${path}: unreviewed/affected brace-expansion ${value.version}`);
if (!copies.length) errors.push('No resolved brace-expansion copies found.');
const wireit = lock.packages?.['node_modules/wireit'];
const wireitBrace = lock.packages?.['node_modules/wireit/node_modules/brace-expansion'] ?? lock.packages?.['node_modules/brace-expansion'];
if (!wireit || wireitBrace?.version !== '5.0.12') errors.push('Wireit must resolve the reviewed brace-expansion 5.0.12 API.');
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Brace-expansion lock graph: ${copies.length} patched copies; Wireit resolves 5.0.12.`);
}
