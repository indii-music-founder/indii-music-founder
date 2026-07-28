#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'packages/firebase/src',
  'packages/renderer/src',
];
const CANONICAL_FILE = path.normalize('packages/firebase/src/lib/vertexRouting.ts');
const HOST_PATTERN =
  /(?:https:\/\/aiplatform(?:\.(?:us|eu)\.rep)?\.googleapis\.com|https:\/\/[^'"]+-aiplatform\.googleapis\.com|`\s*https:\/\/\$\{[^}]+\}-aiplatform\.googleapis\.com)/;
const violations = [];

function visit(entry) {
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entry)) visit(path.join(entry, child));
    return;
  }
  if (
    !/\.[cm]?[jt]sx?$/.test(entry)
    || /\.test\.[cm]?[jt]sx?$/.test(entry)
    || path.normalize(entry) === CANONICAL_FILE
  ) return;

  const lines = fs.readFileSync(entry, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (HOST_PATTERN.test(line)) violations.push(`${entry}:${index + 1}`);
  });
}

ROOTS.forEach(visit);

if (violations.length > 0) {
  console.error('Vertex API hosts must be resolved by lib/vertexRouting.ts:');
  violations.forEach((violation) => console.error(`  ${violation}`));
  process.exit(1);
}

console.log('Vertex routing boundary: no ad hoc feature-code host construction found.');
