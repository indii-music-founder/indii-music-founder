import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const manifests = [];

function collectManifests(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectManifests(path);
    if (entry.isFile() && entry.name === 'package.json') manifests.push(path);
  }
}

collectManifests(root);

const guard = /^npm(?:\s+--prefix\s+\S+)?\s+run repo:assert-canonical &&/;
const deployScripts = manifests.flatMap((manifest) => {
  const { scripts = {} } = JSON.parse(readFileSync(manifest, 'utf8'));
  return Object.entries(scripts)
    .filter(([, command]) => typeof command === 'string' && /\bfirebase\s+deploy\b/.test(command))
    .map(([name, command]) => ({ manifest: relative(root, manifest) || 'package.json', name, command }));
});

const missing = deployScripts.filter(({ command }) => !guard.test(command));
if (missing.length) {
  throw new Error(`Missing canonical guards: ${missing.map(({ manifest, name }) => `${manifest}:${name}`).join(', ')}`);
}

console.log(`Verified canonical-repository guards on ${deployScripts.length} production deploy scripts across ${manifests.length} manifests.`);
