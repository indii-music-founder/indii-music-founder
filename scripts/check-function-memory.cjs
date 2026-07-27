#!/usr/bin/env node
/**
 * Guard against the OOM-on-cold-start failure mode documented in ISSUE-1219 and
 * ISSUE-1238 (ERROR_LEDGER: "Unbundled Monorepo Workspace Import" neighbours).
 *
 * Gen2 Cloud Functions load the ENTIRE bundled `functions/index.js` module graph
 * on cold start — every function pays the same shared import cost regardless of
 * which one was invoked. That shared graph is currently ~259MiB and grows as the
 * monorepo adds functions. A function pinned below that floor cannot bind port
 * 8080 before the OOM killer fires, so its container never starts, its deploy
 * health check fails, and `firebase deploy` fails the WHOLE functions step —
 * taking every unrelated fix in the same push down with it.
 *
 * `packages/firebase/src/index.ts` already calls
 * `setGlobalOptions({ memory: '512MiB' })`, so the default is safe. The failure
 * mode is a per-function `memory:` option that OVERRIDES that global downward.
 * This check exists because ISSUE-1219 fixed three such functions, explicitly
 * predicted more would follow, and left nothing behind to catch the next one —
 * which turned out to be `getCustomerPortal` three days later.
 *
 * Usage: node scripts/check-function-memory.cjs
 * Exits non-zero (and names every offender) if any function pins memory below
 * the floor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'packages', 'firebase', 'src');

/** Tiers that sit at or below the observed cold-start footprint. */
const UNSAFE = new Set(['128MiB', '256MiB']);

/** `memory: '256MiB'` / `memory: "256MiB"`, with or without `as const`. */
const MEMORY_OPTION = /memory\s*:\s*['"]([0-9]+(?:MiB|GiB))['"]/g;

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'lib') continue;
            walk(full, out);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            out.push(full);
        }
    }
    return out;
}

const offenders = [];
for (const file of walk(ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    // factory.ts declares the allowed tiers as a TYPE UNION, not a value — the
    // union legitimately includes the small tiers and must not be flagged.
    if (file.endsWith(path.join('firebase', 'src', 'factory.ts'))) continue;

    const lines = source.split('\n');
    lines.forEach((line, index) => {
        MEMORY_OPTION.lastIndex = 0;
        let match;
        while ((match = MEMORY_OPTION.exec(line)) !== null) {
            if (UNSAFE.has(match[1])) {
                offenders.push({
                    file: path.relative(path.resolve(__dirname, '..'), file),
                    line: index + 1,
                    tier: match[1],
                    text: line.trim(),
                });
            }
        }
    });
}

if (offenders.length === 0) {
    console.log('✅ No Cloud Function pins memory below the 512MiB cold-start floor.');
    process.exit(0);
}

console.error(
    `✖ ${offenders.length} Cloud Function(s) pin memory at or below the shared`
    + ' cold-start footprint (~259MiB). Each will OOM before binding port 8080,'
    + ' fail its deploy health check, and fail the entire functions deploy step:\n',
);
for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  [${o.tier}]  ${o.text}`);
}
console.error(
    '\nFix: raise to \'512MiB\' (or higher), or remove the option entirely to'
    + ' inherit the safe global default set in packages/firebase/src/index.ts.',
);
process.exit(1);
