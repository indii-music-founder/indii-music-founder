#!/usr/bin/env node
/** Verify the resolved lock graph, not just the declared security override (ISSUE-1514). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'package-lock.json'), 'utf8'));
const pinned = manifest.overrides?.['@grpc/grpc-js'];
const version = typeof pinned === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/.exec(pinned) : null;
// Advisory fixes are available in 1.13.6 and 1.14.5; the repository pins 1.14.6.
const approved = version && Number(version[1]) === 1 &&
  ((Number(version[2]) === 13 && Number(version[3]) >= 6) || (Number(version[2]) === 14 && Number(version[3]) >= 5));
if (!approved) throw new Error('gRPC must have an exact reviewed security-patched override.');
const copies = Object.entries(lock.packages ?? {}).filter(([path]) => path.endsWith('node_modules/@grpc/grpc-js'));
if (!copies.length) throw new Error('The lockfile has no resolved gRPC package to validate.');
const stale = copies.filter(([, data]) => data.version !== pinned);
if (stale.length) {
  for (const [path, data] of stale) console.error(`Unpatched gRPC resolution: ${path} = ${data.version}; required ${pinned}`);
  process.exitCode = 1;
} else {
  console.log(`gRPC lock graph: all ${copies.length} resolved copies match patched ${pinned}.`);
}
