#!/usr/bin/env node
/**
 * Sync the video sidecar assets from their canonical sources and bump the
 * web-player cache keys in one command:
 *
 *     npm run sync:video-sidecars
 *
 * Sources of truth:
 * - GSAP:            packages/video-compiler/src/__fixtures__/gsap.min.js
 *                    (version parsed from the file header)
 * - HyperFrames run: node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js
 *                    (version from the installed @hyperframes/core package)
 *
 * Destinations:
 * - packages/renderer/public/gsap.min.js            (web player, same-origin)
 * - packages/renderer/public/hyperframe.runtime.iife.js
 * - packages/main/src/services/video/hyperframes/__fixtures__/gsap.min.js
 * - rewrites GSAP_SIDECAR_SRC / HYPERFRAMES_RUNTIME_SRC (?v= keys) in
 *   packages/renderer/src/services/video/webPreviewCompiler.ts
 *
 * After running: `npx tsc -b packages/video-compiler && npx vitest run
 * --project video-compiler` — the drift-guard suite must stay green.
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const GSAP_CANONICAL = 'packages/video-compiler/src/__fixtures__/gsap.min.js';
const GSAP_MAIN_FIXTURE = 'packages/main/src/services/video/hyperframes/__fixtures__/gsap.min.js';
const GSAP_PUBLIC = 'packages/renderer/public/gsap.min.js';
const RUNTIME_SOURCE = 'node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js';
const RUNTIME_PUBLIC = 'packages/renderer/public/hyperframe.runtime.iife.js';
const TRANSFORM_SOURCE = 'packages/renderer/src/services/video/webPreviewCompiler.ts';

const read = (rel) => readFile(resolve(REPO_ROOT, rel), 'utf8');

const gsap = await read(GSAP_CANONICAL);
const gsapVersion = gsap.match(/GSAP (\d+\.\d+\.\d+)/)?.[1];
if (!gsapVersion) {
    console.error(`FAIL: could not parse the GSAP version from ${GSAP_CANONICAL}`);
    process.exit(1);
}

let coreVersion;
try {
    coreVersion = JSON.parse(await read('node_modules/@hyperframes/core/package.json')).version;
} catch {
    console.error('FAIL: @hyperframes/core is not installed — run the player upgrade first.');
    process.exit(1);
}

await copyFile(resolve(REPO_ROOT, GSAP_CANONICAL), resolve(REPO_ROOT, GSAP_PUBLIC));
await copyFile(resolve(REPO_ROOT, GSAP_CANONICAL), resolve(REPO_ROOT, GSAP_MAIN_FIXTURE));
await copyFile(resolve(REPO_ROOT, RUNTIME_SOURCE), resolve(REPO_ROOT, RUNTIME_PUBLIC));

const transformPath = resolve(REPO_ROOT, TRANSFORM_SOURCE);
let transform = await readFile(transformPath, 'utf8');
const nextGsap = `export const GSAP_SIDECAR_SRC = '/gsap.min.js?v=${gsapVersion}';`;
const nextRuntime = `export const HYPERFRAMES_RUNTIME_SRC = '/hyperframe.runtime.iife.js?v=${coreVersion}';`;
if (!/export const GSAP_SIDECAR_SRC = '\/gsap\.min\.js\?v=[^']+';/.test(transform)
    || !/export const HYPERFRAMES_RUNTIME_SRC = '\/hyperframe\.runtime\.iife\.js\?v=[^']+';/.test(transform)) {
    console.error('FAIL: cache-key constants not found in webPreviewCompiler.ts — aborting before edits.');
    process.exit(1);
}
transform = transform
    .replace(/export const GSAP_SIDECAR_SRC = '\/gsap\.min\.js\?v=[^']+';/, nextGsap)
    .replace(/export const HYPERFRAMES_RUNTIME_SRC = '\/hyperframe\.runtime\.iife\.js\?v=[^']+';/, nextRuntime);
await writeFile(transformPath, transform);

console.log(`gsap ${gsapVersion}: public/ + main fixtures synced`);
console.log(`hyperframes runtime ${coreVersion}: public/ synced`);
console.log(`cache keys bumped in ${TRANSFORM_SOURCE}`);
console.log('Next: npx tsc -b packages/video-compiler && npx vitest run --project video-compiler');
