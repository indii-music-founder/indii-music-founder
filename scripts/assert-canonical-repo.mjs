#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CANONICAL_REPOSITORY = 'indii-music-founder/indii-music-founder';
const RETIRED_REPOSITORIES = new Set([
  'the-walking-agency-det/indii-music-founder',
  'the-walking-agency-det/indiiOS-Clean',
  'new-detroit-music-llc/indiiOS-Alpha-Electron',
]);

export function normalizeGitHubRemote(rawRemote) {
  const raw = String(rawRemote ?? '').trim().replace(/\/+$/, '');
  if (!raw) return '';

  const scpLike = raw.match(/^git@github\.com:(.+)$/i);
  if (scpLike) return scpLike[1].replace(/^\/+|\.git$/g, '');

  try {
    const url = new URL(raw);
    if (url.hostname.toLowerCase() !== 'github.com') return '';
    return url.pathname.replace(/^\/+/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function assertCanonicalRepository(remoteUrl) {
  const actual = normalizeGitHubRemote(remoteUrl);
  if (actual === CANONICAL_REPOSITORY) return actual;

  const retired = RETIRED_REPOSITORIES.has(actual);
  const detail = actual || String(remoteUrl ?? '').trim() || '(missing origin)';
  throw new Error([
    'WRONG REPOSITORY — refusing to continue.',
    `Expected: ${CANONICAL_REPOSITORY}`,
    `Actual:   ${detail}`,
    retired
      ? 'This checkout is a retired historical repository. Do not commit, push, build, or deploy from it.'
      : 'This checkout is not the canonical indii.music repository.',
  ].join('\n'));
}

function readOrigin() {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error([
      'CANONICAL REPOSITORY CHECK FAILED — no readable git origin.',
      `Expected: ${CANONICAL_REPOSITORY}`,
      'Run this command only from the canonical indii.music checkout.',
    ].join('\n'));
  }
}

function main() {
  try {
    const actual = assertCanonicalRepository(readOrigin());
    console.log(`Canonical repository verified: ${actual}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(42);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
