#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const capabilitiesDir = path.join(repoRoot, '.agent', 'capabilities');
const registryPath = path.join(capabilitiesDir, 'registry.json');
const evalsPath = path.join(capabilitiesDir, 'routing-evals.json');
const catalogJsonPath = path.join(capabilitiesDir, 'catalog.json');
const catalogMarkdownPath = path.join(capabilitiesDir, 'catalog.md');
const checkOnly = process.argv.includes('--check');

const allowedStates = new Set(['certified', 'conditional', 'quarantined', 'deprecated']);
const requiredContractFields = [
  'authority',
  'prerequisites',
  'outputs',
  'verification',
  'failure',
  'fallback',
  'idempotency',
  'authenticity'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function slug(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function frontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return {};
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return {};
  const lines = markdown.slice(4, end).split('\n');
  const parsed = {};

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (rawValue === '|' || rawValue === '>') {
      const folded = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        folded.push(lines[index].trim());
      }
      parsed[key] = folded.join(rawValue === '>' ? ' ' : '\n').trim();
    } else {
      parsed[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
    }
  }

  return parsed;
}

function firstHeading(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function firstParagraph(markdown) {
  const body = markdown.startsWith('---\n')
    ? markdown.slice(markdown.indexOf('\n---\n', 4) + 5)
    : markdown;
  return body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^#+\s+.*$/gm, '').trim())
    .find((block) => block && !block.startsWith('```') && !block.startsWith('>')) ?? '';
}

function listMarkdownChildren(parentDir) {
  if (!fs.existsSync(parentDir)) return [];
  return fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name, 'SKILL.md'))
    .filter((filePath) => fs.existsSync(filePath))
    .sort();
}

function mergeContract(sourceType, override = {}) {
  const defaults = registry.defaults[sourceType];
  if (!defaults) throw new Error(`Missing defaults for source type: ${sourceType}`);
  return { ...defaults, ...override };
}

function makeFileEntry({ id, name, sourceType, registryName, filePath, mutable, override }) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const metadata = frontmatter(contents);
  const description = metadata.description || firstParagraph(contents) || firstHeading(contents);
  const contract = mergeContract(sourceType, override);
  return {
    id,
    name,
    kind: sourceType === 'workflow' ? 'workflow' : 'skill',
    registry: registryName,
    path: path.relative(repoRoot, filePath),
    mutable,
    available: true,
    description,
    descriptionHash: sha256(description),
    contentHash: sha256(contents),
    ...contract,
    conflicts: override?.conflicts ?? []
  };
}

function statusForPackageScript(name) {
  return 'quarantined';
}

function validateLinks(entry, failures) {
  if (!entry.path || !entry.available || !['certified', 'conditional'].includes(entry.state)) return;
  const filePath = path.join(repoRoot, entry.path);
  const markdown = fs.readFileSync(filePath, 'utf8');
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
    if (!rawTarget || /^(?:https?:|file:|mailto:|#)/.test(rawTarget) || rawTarget.includes('<')) continue;
    const decoded = decodeURIComponent(rawTarget);
    const localTarget = path.resolve(path.dirname(filePath), decoded);
    const rootTarget = path.resolve(repoRoot, decoded);
    if (!fs.existsSync(localTarget) && !fs.existsSync(rootTarget)) {
      failures.push(`${entry.id}: broken relative link ${rawTarget}`);
    }
  }
}

function validateSelectableSafety(entry, failures) {
  if (!entry.path || !entry.available || !['certified', 'conditional'].includes(entry.state)) return;
  const contents = fs.readFileSync(path.join(repoRoot, entry.path), 'utf8');
  const forbidden = [
    ['catch-all staging', /\bgit add -A\b/],
    ['automatic branch creation', /\bgit (?:checkout -b|switch -c)\b/],
    ['history-rewriting pull', /\bgit pull --rebase\b/],
    ['token harvesting from .env', /(?:export[^\n]*TOKEN|grep[^\n]*TOKEN)[^\n]*\.env/],
    ['hard-coded browser subagent dependency', /\bbrowser subagent\b/i],
    ['hard-coded chrome-devtools dependency', /\bchrome-devtools\b/i],
    ['unbounded no-confirmation fix instruction', /DO NOT ASK[^\n]*fix/i]
  ];
  for (const [label, pattern] of forbidden) {
    if (pattern.test(contents)) failures.push(`${entry.id}: selectable capability contains ${label}`);
  }

  for (const [index, line] of contents.split('\n').entries()) {
    const instruction = line.replace(/^\s*[-*]\s*/, '');
    if (!/^\s*git\s+push\b/.test(instruction)) continue;
    if (line.includes('git push origin HEAD:main') || /block|prevent|forbid|never/i.test(line)) continue;
    failures.push(`${entry.id}:${index + 1}: ambiguous push instruction`);
  }
}

function validateMarkdownStructure(entry, failures) {
  if (!entry.path || !entry.available || !entry.path.endsWith('.md')) return;
  const contents = fs.readFileSync(path.join(repoRoot, entry.path), 'utf8');
  const fenceCount = contents.split('\n').filter((line) => line.trimStart().startsWith('```')).length;
  if (fenceCount % 2 !== 0) failures.push(`${entry.id}: unbalanced fenced code blocks`);
  const lineCount = contents.split('\n').length;
  if (entry.registry === '.agent/skills' && lineCount > 500) {
    failures.push(`${entry.id}: owned SKILL.md exceeds the 500-line progressive-disclosure limit (${lineCount})`);
  }
}

const registry = readJson(registryPath);
const evals = readJson(evalsPath);
const entries = [];
const failures = [];

const workflowDir = path.join(repoRoot, '.agent', 'workflows');
for (const filename of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.md')).sort()) {
  const name = filename.slice(0, -3);
  const id = `workflow:${slug(name)}`;
  if (!Object.hasOwn(registry.overrides, id)) failures.push(`${id}: missing explicit workflow contract override`);
  entries.push(makeFileEntry({
    id,
    name,
    sourceType: 'workflow',
    registryName: '.agent/workflows',
    filePath: path.join(workflowDir, filename),
    mutable: true,
    override: registry.overrides[id]
  }));
}

const ownedSkillPaths = listMarkdownChildren(path.join(repoRoot, '.agent', 'skills'));
for (const filePath of ownedSkillPaths) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const metadata = frontmatter(contents);
  if (!metadata.name || !metadata.description) {
    failures.push(`${path.relative(repoRoot, filePath)}: owned skill requires name and description frontmatter`);
    continue;
  }
  const id = `skill:owned:${slug(metadata.name)}`;
  if (!Object.hasOwn(registry.overrides, id)) failures.push(`${id}: missing explicit owned-skill contract override`);
  entries.push(makeFileEntry({
    id,
    name: metadata.name,
    sourceType: 'owned-skill',
    registryName: '.agent/skills',
    filePath,
    mutable: true,
    override: registry.overrides[id]
  }));
}

for (const filePath of listMarkdownChildren(path.join(repoRoot, 'skills'))) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const metadata = frontmatter(contents);
  if (!metadata.name || !metadata.description) {
    failures.push(`${path.relative(repoRoot, filePath)}: proprietary skill requires name and description frontmatter`);
    continue;
  }
  const id = `skill:proprietary:${slug(metadata.name)}`;
  if (!Object.hasOwn(registry.overrides, id)) failures.push(`${id}: missing explicit proprietary-skill contract override`);
  entries.push(makeFileEntry({
    id,
    name: metadata.name,
    sourceType: 'proprietary-skill',
    registryName: 'skills',
    filePath,
    mutable: true,
    override: registry.overrides[id]
  }));
}

const lock = readJson(path.join(repoRoot, 'skills-lock.json'));
const installedVendored = new Map(
  listMarkdownChildren(path.join(repoRoot, '.agents', 'skills')).map((filePath) => [path.basename(path.dirname(filePath)), filePath])
);
for (const name of [...new Set([...Object.keys(lock.skills), ...installedVendored.keys()])].sort()) {
  const id = `skill:vendored:${slug(name)}`;
  const filePath = installedVendored.get(name);
  const lockEntry = lock.skills[name];
  if (filePath) {
    const entry = makeFileEntry({
      id,
      name,
      sourceType: 'vendored-skill',
      registryName: '.agents/skills',
      filePath,
      mutable: false,
      override: registry.overrides[id]
    });
    entry.locked = Boolean(lockEntry);
    entry.upstream = lockEntry?.source ?? null;
    entry.lockHash = lockEntry?.computedHash ?? null;
    if (!lockEntry) {
      entry.state = 'quarantined';
      entry.reason = 'Installed vendored skill has no skills-lock.json entry.';
    }
    entries.push(entry);
  } else {
    entries.push({
      id,
      name,
      kind: 'skill',
      registry: '.agents/skills',
      path: null,
      mutable: false,
      available: false,
      description: 'Locked vendored skill is not installed on this machine.',
      descriptionHash: sha256('Locked vendored skill is not installed on this machine.'),
      contentHash: null,
      ...mergeContract('vendored-skill', { state: 'quarantined', reason: 'Lock entry exists but the skill is not installed.' }),
      locked: true,
      upstream: lockEntry?.source ?? null,
      lockHash: lockEntry?.computedHash ?? null,
      conflicts: []
    });
  }
}

const packageJson = readJson(path.join(repoRoot, 'package.json'));
for (const name of Object.keys(packageJson.scripts ?? {}).sort()) {
  const id = `script:npm:${name}`;
  const command = packageJson.scripts[name];
  const override = registry.overrides[id] ?? {
    state: statusForPackageScript(name),
    reason: 'Package script has not been explicitly reviewed for automatic routing.'
  };
  entries.push({
    id,
    name: `npm run ${name}`,
    kind: 'script',
    registry: 'package.json',
    path: 'package.json',
    mutable: true,
    available: true,
    description: command,
    descriptionHash: sha256(command),
    contentHash: sha256(`${name}:${command}`),
    ...mergeContract('npm-script', override),
    conflicts: override.conflicts ?? []
  });
}

entries.push({
  id: 'registry:user-global',
  name: 'User-global skills overlay',
  kind: 'dynamic-registry',
  registry: '~/.agents/skills',
  path: null,
  mutable: false,
  available: null,
  description: 'Session-specific user-global skills; discover at runtime and never assume availability.',
  descriptionHash: sha256('Session-specific user-global skills; discover at runtime and never assume availability.'),
  contentHash: null,
  ...mergeContract('vendored-skill', {
    state: 'conditional',
    authority: 'inherits-active-request',
    prerequisites: ['The runtime registry exists', 'The selected skill passes the session authority and tool checks']
  }),
  conflicts: []
});

entries.sort((left, right) => left.id.localeCompare(right.id));

const ids = new Set();
for (const entry of entries) {
  if (ids.has(entry.id)) failures.push(`${entry.id}: duplicate capability id`);
  ids.add(entry.id);
  if (!allowedStates.has(entry.state)) failures.push(`${entry.id}: invalid state ${entry.state}`);
  if (['certified', 'conditional'].includes(entry.state)) {
    for (const field of requiredContractFields) {
      const value = entry[field];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        failures.push(`${entry.id}: selectable capability missing ${field}`);
      }
    }
    if (entry.available === false) failures.push(`${entry.id}: unavailable capability cannot be selectable`);
  }
  validateLinks(entry, failures);
  validateSelectableSafety(entry, failures);
  validateMarkdownStructure(entry, failures);
}

for (const testCase of evals.cases ?? []) {
  for (const id of [...(testCase.expected ?? []), ...(testCase.forbidden ?? [])]) {
    if (!ids.has(id)) failures.push(`routing eval ${testCase.id}: unknown capability ${id}`);
  }
  for (const id of testCase.expected ?? []) {
    const entry = entries.find((candidate) => candidate.id === id);
    if (entry && ['quarantined', 'deprecated'].includes(entry.state)) {
      failures.push(`routing eval ${testCase.id}: expected capability ${id} is ${entry.state}`);
    }
  }
}

const sourceDigest = sha256(JSON.stringify(entries.map(({ id, contentHash, state, available }) => ({ id, contentHash, state, available }))));
const counts = Object.fromEntries([...allowedStates].map((state) => [state, entries.filter((entry) => entry.state === state).length]));
const catalog = {
  schemaVersion: 1,
  sourceDigest,
  contract: '.agent/capabilities/CONTRACT.md',
  registry: '.agent/capabilities/registry.json',
  routingEvals: '.agent/capabilities/routing-evals.json',
  dynamicOverlayRule: 'At runtime, merge only tools actually exposed by the current host. Session tools inherit active authority and require the same contract checks.',
  counts,
  capabilities: entries
};

const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`;
const markdownRows = entries
  .map((entry) => `| \`${entry.id}\` | ${entry.state} | ${entry.authority} | ${entry.available === null ? 'runtime' : entry.available ? 'yes' : 'no'} | ${entry.path ?? 'dynamic'} |`)
  .join('\n');
const catalogMarkdown = `# Generated Capability Catalog\n\n> Generated by \`npm run capabilities:generate\`. Do not edit by hand.\n\n- Source digest: \`${sourceDigest}\`\n- Certified: ${counts.certified}\n- Conditional: ${counts.conditional}\n- Quarantined: ${counts.quarantined}\n- Deprecated: ${counts.deprecated}\n\nThe router may select only Certified entries or Conditional entries whose prerequisites pass. Runtime MCP, connector, browser, computer-use, and other host-native tools are added as a session overlay and must satisfy the same contract.\n\n| Capability | State | Authority | Available | Source |\n| --- | --- | --- | --- | --- |\n${markdownRows}\n`;

if (failures.length > 0) {
  console.error('Capability validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (checkOnly) {
  const existingJson = fs.existsSync(catalogJsonPath) ? fs.readFileSync(catalogJsonPath, 'utf8') : '';
  const existingMarkdown = fs.existsSync(catalogMarkdownPath) ? fs.readFileSync(catalogMarkdownPath, 'utf8') : '';
  if (existingJson !== catalogJson || existingMarkdown !== catalogMarkdown) {
    console.error('Capability catalog is stale. Run npm run capabilities:generate.');
    process.exit(1);
  }
  console.log(`Capability catalog valid: ${entries.length} entries, ${counts.certified} certified, ${counts.conditional} conditional.`);
} else {
  fs.mkdirSync(capabilitiesDir, { recursive: true });
  fs.writeFileSync(catalogJsonPath, catalogJson);
  fs.writeFileSync(catalogMarkdownPath, catalogMarkdown);
  console.log(`Generated capability catalog: ${entries.length} entries, ${counts.certified} certified, ${counts.conditional} conditional.`);
}
