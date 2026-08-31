#!/usr/bin/env node
/**
 * Vendor IMG.LY background-removal model weights into the app's public assets.
 *
 * Usage: node scripts/vendor-imgly-weights.mjs
 *
 * Fetches the weight package from IMG.LY's CDN and extracts it into
 * packages/renderer/public/models/background-removal/ so the browser never
 * fetches from the CDN at runtime (Ground Rule 8). The ~285MB of weights are
 * gitignored — only LICENSES.md (and this script) are committed.
 *
 * Re-run after bumping `@imgly/background-removal` to a new version
 * (set IMGLY_VERSION to match, or edit the default below).
 */
import { spawnSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = process.env.IMGLY_VERSION || '1.7.0';
const URL = `https://staticimgly.com/@imgly/background-removal-data/${VERSION}/package.tgz`;
const TARGET = path.join(__dirname, '../packages/renderer/public/models/background-removal');
const TMP = path.join(__dirname, '../.imgly-weights.tgz');

async function main() {
    console.log(`Vendoring @imgly/background-removal weights v${VERSION} ...`);
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status})`);

    const buf = new Uint8Array(await res.arrayBuffer());
    writeFileSync(TMP, buf);
    console.log(`✓ Downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

    rmSync(TARGET, { recursive: true, force: true });
    mkdirSync(TARGET, { recursive: true });
    const tar = spawnSync('tar', ['-xzf', TMP, '-C', TARGET, '--strip-components=2'], { stdio: 'inherit' });
    if (tar.status !== 0) throw new Error('tar extraction failed');
    rmSync(TMP, { force: true });

    console.log(`✓ Vendored weights to ${TARGET}`);
}

main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
});
