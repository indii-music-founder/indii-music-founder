#!/usr/bin/env node
/**
 * Vendor the embedded video text fonts (one-time snapshot generator).
 *
 * The video compiler's typography contract (EMBEDDED_TEXT_FONT_FAMILIES in
 * packages/video-compiler/src/compiler.ts) promises 8 families, but nothing
 * shipped their font files — previews AND renders fell back to sans-serif.
 * This script fetches each family from Google Fonts (css2 API, woff2 UA),
 * keeps the latin subset, and generates
 * `packages/video-compiler/src/fontAssets.generated.ts` — a pure-data module
 * every executor (web bridge, desktop main, render worker) can hand to
 * `compileProjectToHyperFrames({ fontAssets })`.
 *
 * All 8 families are SIL Open Font License. Re-run only to refresh the
 * snapshot; the output is committed so builds never depend on the network.
 *
 * Usage: node scripts/vendor-video-fonts.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(REPO_ROOT, 'packages/video-compiler/src/fontAssets.generated.ts');

// woff2-capable Chrome UA — Google serves woff2 latin subsets to this UA.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Family spec. `axis` uses the css2 variable-range syntax when the family
 * ships a variable wght axis (one file covers every weight); static families
 * list discrete weights. Availability per Google Fonts (2025-09):
 * - Archivo Black: display family, single weight (400).
 * - Space Mono: 400, 700.
 * - IBM Plex Mono: 400, 500, 700 (no 900).
 * - League Gothic: variable wght 300..400.
 * - Oswald: variable wght 200..700 (900 renders via synthetic bolding).
 */
const FAMILIES = [
    { family: 'Archivo Black', query: 'Archivo+Black', weights: [400] },
    { family: 'Space Mono', query: 'Space+Mono', weights: [400, 700] },
    { family: 'IBM Plex Mono', query: 'IBM+Plex+Mono', weights: [400, 500, 700] },
    { family: 'Montserrat', query: 'Montserrat:wght@400..900', weights: ['400..900'] },
    { family: 'Oswald', query: 'Oswald:wght@400..700', weights: ['400..700'] },
    { family: 'League Gothic', query: 'League+Gothic', weights: [400] },
    { family: 'JetBrains Mono', query: 'JetBrains+Mono:wght@400..800', weights: ['400..800'] },
    { family: 'Source Code Pro', query: 'Source+Code+Pro:wght@400..900', weights: ['400..900'] },
];

const css2Url = (query) => `https://fonts.googleapis.com/css2?family=${query}&display=block`;

/** Pull the latin-subset @font-face blocks (the LAST block per family is latin). */
function parseLatinFaces(cssText) {
    const faces = [];
    const blockRe = /\/\*\s*(\w[\w-]*)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
    let match;
    while ((match = blockRe.exec(cssText)) !== null) {
        if (match[1] !== 'latin') continue;
        const body = match[2];
        const weight = body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim();
        const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
        if (weight && url) faces.push({ weight, url });
    }
    return faces;
}

async function fetchText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return res.text();
}

async function fetchBuffer(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

const result = {};
for (const spec of FAMILIES) {
    const css = await fetchText(css2Url(spec.query));
    const faces = parseLatinFaces(css);
    if (faces.length === 0) throw new Error(`no latin @font-face found for ${spec.family}`);
    result[spec.family] = {};
    for (const face of faces) {
        const bytes = await fetchBuffer(face.url);
        result[spec.family][face.weight] = bytes.toString('base64');
        console.log(`${spec.family} [${face.weight}]: ${(bytes.length / 1024).toFixed(1)} KB`);
    }
}

const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Regen: node scripts/vendor-video-fonts.mjs
 *
 * Vendored latin-subset woff2 snapshots (SIL OFL) of the compiler typography
 * contract families (EMBEDDED_TEXT_FONT_FAMILIES). Consumers pass these to
 * compileProjectToHyperFrames({ fontAssets }) — the compiler emits @font-face
 * data-URIs for exactly the families/weights a project uses, keeping the
 * composition standalone (no network, deterministic in cloud renders).
 */
`;

const body = `${header}export const EMBEDDED_FONT_FACE_ASSETS: Record<string, Record<string, string>> = ${JSON.stringify(result, null, 2)} as const;\n`;

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, body);
const totalKb = Object.values(result).flatMap(w => Object.values(w)).reduce((sum, b64) => sum + b64.length, 0) / 1024;
console.log(`\nWrote ${OUT_FILE}`);
console.log(`Families: ${Object.keys(result).length}, total base64: ${(totalKb).toFixed(0)} KB`);
