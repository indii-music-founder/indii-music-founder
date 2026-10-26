import fs from 'node:fs';

const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const functions = JSON.parse(fs.readFileSync('packages/firebase/package.json', 'utf8'));
const requiredMajor = Number(/^>=(\d+)\./.exec(root.engines?.node ?? '')?.[1]);
const failures = [];

if (!Number.isSafeInteger(requiredMajor)) {
  failures.push(`root engines.node must declare a minimum major version (found ${root.engines?.node ?? 'missing'})`);
}
if (functions.engines?.node !== '22') {
  failures.push(`Firebase Functions runtime must remain independently declared as Node 22 (found ${functions.engines?.node ?? 'missing'})`);
}

for (const workflow of ['.github/workflows/build.yml', '.github/workflows/deploy.yml']) {
  const source = fs.readFileSync(workflow, 'utf8');
  const steps = [...source.matchAll(/^\s*uses:\s*actions\/setup-node@[^\n]+/gm)];
  const configured = [...source.matchAll(/^\s*uses:\s*actions\/setup-node@[^\n]+\n\s*with:\s*\n\s*node-version:\s*['"]?(\d+)\.x['"]?/gm)];
  if (!steps.length) failures.push(`${workflow}: no setup-node steps found`);
  if (steps.length !== configured.length) failures.push(`${workflow}: every setup-node step must declare a Node major`);
  for (const match of configured) {
    if (Number(match[1]) !== requiredMajor) {
      failures.push(`${workflow}: setup-node requests ${match[1]}.x, root engines.node requires ${requiredMajor}.x`);
    }
  }
  console.log(`${workflow}: ${configured.length} setup-node step(s) use Node ${requiredMajor}.x`);
}

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('CI host Node versions match the root engine; Firebase Functions remains Node 22.');
}
