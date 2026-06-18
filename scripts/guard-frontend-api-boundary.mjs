#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const sourceRoots = [
  'packages/renderer/src',
  'packages/landing/src',
  'packages/shared/src',
];

const workflowRoot = '.github/workflows';
const frontendConfigFiles = [
  'electron.vite.config.ts',
  'packages/renderer/vite.config.ts',
  'packages/landing/vite.config.ts',
];

const backendSourceRoots = [
  'packages/firebase/src',
];

const forbiddenEnvNames = new Set([
  'VITE_API_KEY',
  'VITE_MEM0_API_KEY',
  'VITE_GOOGLE_DEVKNOWLEDGE_API_KEY',
  'VITE_PINATA_API_KEY',
  'VITE_PINATA_SECRET_KEY',
  'VITE_PINATA_JWT',
  'VITE_OPENSEA_API_KEY',
  'VITE_ALCHEMY_API_KEY',
  'VITE_ETH_RPC_URL',
  'VITE_UD_API_KEY',
  'VITE_NOTARIZE_API_KEY',
  'VITE_DOCUSIGN_ACCESS_TOKEN',
  'VITE_DOCUSIGN_BASE_URL',
  'VITE_DOCUSIGN_ACCOUNT_ID',
  'VITE_PARTNER_API_TOKEN',
  'VITE_APPLE_MUSIC_DEV_TOKEN',
]);

const forbiddenEnvSuffixes = [
  /_SECRET(?:_KEY)?$/,
  /_PRIVATE_KEY$/,
  /_JWT$/,
];

const allowedTokenEnvNames = new Set([
  'VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN',
]);

const forbiddenWorkflowEnvNames = new Set([
  ...forbiddenEnvNames,
  'VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN',
]);

const forbiddenProviderHosts = [
  'api.mem0.ai',
  'developerknowledge.googleapis.com',
  'api.pinata.cloud',
  'api.opensea.io',
  'g.alchemy.com',
  'api.notarize.com',
  'acrcloud.com',
];

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const workflowExtensions = new Set(['.yml', '.yaml']);
const failures = [];

function walk(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '__tests__') {
        continue;
      }
      walk(full, predicate, acc);
    } else if (predicate(full)) {
      acc.push(full);
    }
  }
  return acc;
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function report(file, index, message) {
  const before = file.text.slice(0, index);
  const line = before.split(/\r?\n/).length;
  failures.push(`${file.rel}:${line} ${message}`);
}

function isForbiddenEnvName(name) {
  if (allowedTokenEnvNames.has(name)) return false;
  return forbiddenEnvNames.has(name) || forbiddenEnvSuffixes.some((pattern) => pattern.test(name));
}

for (const sourceRoot of sourceRoots) {
  const absRoot = path.join(root, sourceRoot);
  const files = walk(absRoot, (file) => {
    const ext = path.extname(file);
    if (!sourceExtensions.has(ext)) return false;
    if (file.endsWith('.safe')) return false;
    if (/\.(test|spec)\.[jt]sx?$/.test(file)) return false;
    return true;
  });

  for (const abs of files) {
    const rel = path.relative(root, abs);
    const raw = fs.readFileSync(abs, 'utf8');
    const text = stripComments(raw);
    const file = { rel, text };

    for (const match of text.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
      const name = match[1];
      if (name && isForbiddenEnvName(name)) {
        report(file, match.index ?? 0, `forbidden browser env access: ${name}`);
      }
    }

    for (const host of forbiddenProviderHosts) {
      const index = text.indexOf(host);
      if (index !== -1) {
        report(file, index, `forbidden direct provider endpoint in frontend: ${host}`);
      }
    }

    if (/@google\/genai|GoogleGenAI/.test(text)) {
      report(file, text.search(/@google\/genai|GoogleGenAI/), 'forbidden raw Gemini SDK reference in frontend source');
    }
  }
}

for (const sourceRoot of backendSourceRoots) {
  const absRoot = path.join(root, sourceRoot);
  const files = walk(absRoot, (file) => {
    const ext = path.extname(file);
    if (!sourceExtensions.has(ext)) return false;
    if (/\.(test|spec)\.[jt]sx?$/.test(file)) return false;
    return true;
  });

  for (const abs of files) {
    const rel = path.relative(root, abs);
    const raw = fs.readFileSync(abs, 'utf8');
    const text = stripComments(raw);
    const file = { rel, text };

    const match = text.match(/process\.env\.VITE_API_KEY/);
    if (match?.index !== undefined) {
      report(file, match.index, 'backend Gemini credentials must use GEMINI_API_KEY or GOOGLE_GENAI_API_KEY, not VITE_API_KEY');
    }
  }
}

const workflowFiles = walk(path.join(root, workflowRoot), (file) => workflowExtensions.has(path.extname(file)));
for (const abs of workflowFiles) {
  const rel = path.relative(root, abs);
  const text = fs.readFileSync(abs, 'utf8');
  const file = { rel, text };

  for (const name of forbiddenWorkflowEnvNames) {
    const index = text.indexOf(name);
    if (index !== -1) {
      report(file, index, `forbidden frontend secret/env injected by workflow: ${name}`);
    }
  }
}

for (const rel of frontendConfigFiles) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;

  const text = fs.readFileSync(abs, 'utf8');
  const file = { rel, text };

  const broadPrefixes = [
    /['"`]VITE_['"`]/,
    /['"`]VITE_APP_['"`]/,
    /['"`]NEXT_PUBLIC_['"`]/,
  ];
  for (const pattern of broadPrefixes) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      report(file, match.index, `frontend config exposes overly broad env prefix: ${match[0]}`);
    }
  }

  for (const name of forbiddenEnvNames) {
    const pattern = new RegExp(`import\\.meta\\.env\\.${name.replaceAll('_', '\\_')}`);
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      report(file, match.index, `frontend config defines forbidden browser env placeholder: ${name}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Frontend API boundary guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Frontend API boundary guard passed.');
