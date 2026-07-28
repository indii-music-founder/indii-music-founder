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
 * There are TWO ways to land below the floor, and this guard checks both.
 *
 * 1. UNDER-PINNED — a per-function `memory:` option that overrides the default
 *    downward. This is what ISSUE-1219 and ISSUE-1238 fixed.
 *
 * 2. UN-PINNED GEN1 — a `firebase-functions/v1` trigger that sets no `memory`
 *    at all. `packages/firebase/src/index.ts` calls
 *    `setGlobalOptions({ memory: '512MiB' })`, but that helper is imported from
 *    `firebase-functions/v2` and applies to v2 declarations ONLY. A Gen1
 *    declaration with no `memory` does not inherit it — it silently takes
 *    Gen1's own 256MB default and lands below the floor.
 *
 * Case 2 is why this guard was rewritten. Its earlier version asserted "the
 * default is safe" and told authors to "remove the option entirely to inherit
 * the safe global default" — advice that is correct for v2 and actively CAUSES
 * the bug on Gen1. That blind spot is exactly the shape of ISSUE-1242:
 * `generateContentStream` pinned nothing, silently ran at 256MB, could not
 * complete its outbound Arcjet call under memory pressure, and denied 100% of
 * authenticated AI requests in production — while this script printed a green
 * checkmark. A guard that reports success over an un-pinned Gen1 function is
 * worse than no guard, because it is cited as evidence the class is closed.
 *
 * Usage: node scripts/check-function-memory.cjs
 * Exits non-zero (and names every offender) if any function pins memory below
 * the floor, or is a Gen1 trigger that pins nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'packages', 'firebase', 'src');

/**
 * Tiers at or below the observed cold-start footprint.
 *
 * ISSUE-1242: this set originally held only the v2 spellings (`MiB`). Gen1
 * `functions.runWith({ memory: '256MB' })` uses `MB`, so the original guard was
 * blind to every Gen1 declaration — which is exactly how `generateContentStream`
 * survived the ISSUE-1238 sweep and went on to deny 100% of authenticated AI
 * requests in production. Both spellings are checked now.
 */
const UNSAFE = new Set(['128MiB', '256MiB', '128MB', '256MB']);

/** `memory: '256MiB'` (v2) or `memory: "256MB"` (Gen1 runWith), either quote style. */
const MEMORY_OPTION = /memory\s*:\s*['"]([0-9]+(?:MiB|GiB|MB|GB))['"]/g;

/**
 * A Gen1 trigger declaration: `functions`, an optional `.region(...)` and/or
 * `.runWith({...})`, then the provider/trigger pair. The captured `runWith`
 * body is what we inspect for a `memory` key. Written to tolerate one level of
 * object nesting inside `runWith` (e.g. `failurePolicy: { retry: true }`).
 */
const GEN1_DECLARATION =
    /functions\s*(?:\.region\(\s*[^)]*\))?\s*(?:\.runWith\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\))?\s*\.(https\.onCall|https\.onRequest|firestore\.document|pubsub\.schedule|storage\.object|auth\.user)\s*\(/g;

/** Gen1 has no `setGlobalOptions`; an un-pinned declaration takes this. */
const GEN1_DEFAULT_MEMORY = '256MB';

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Only `node_modules` is skipped. An earlier version also skipped any
            // directory named `lib`, intending to skip compiled output — but
            // ROOT is already scoped to `src/`, and compiled output lives at
            // `packages/firebase/lib`, OUTSIDE it. The only thing that rule
            // actually excluded was `packages/firebase/src/lib/`, which is real
            // source holding image_generation, audio, video, touring, marketing
            // and more. The guard was blind to that whole directory.
            if (entry.name === 'node_modules') continue;
            walk(full, out);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            out.push(full);
        }
    }
    return out;
}

/**
 * `src/test/setup.ts` documents trigger shapes for the Vitest mock factory. Its
 * `functions.x.y()` occurrences are mock scaffolding, not deployed functions.
 */
function isTestHarness(file) {
    return file.endsWith(path.join('firebase', 'src', 'test', 'setup.ts'));
}

const offenders = [];
const unpinnedGen1 = [];
for (const file of walk(ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(path.resolve(__dirname, '..'), file);
    // factory.ts declares the allowed tiers as a TYPE UNION, not a value — the
    // union legitimately includes the small tiers and must not be flagged.
    if (file.endsWith(path.join('firebase', 'src', 'factory.ts'))) continue;

    // Case 1 — explicitly pinned below the floor (either generation).
    const lines = source.split('\n');
    lines.forEach((line, index) => {
        MEMORY_OPTION.lastIndex = 0;
        let match;
        while ((match = MEMORY_OPTION.exec(line)) !== null) {
            if (UNSAFE.has(match[1])) {
                offenders.push({ file: rel, line: index + 1, tier: match[1], text: line.trim() });
            }
        }
    });

    // Case 2 — Gen1 trigger that pins nothing. Only meaningful in a file that
    // actually imports v1; a v2 declaration correctly inherits setGlobalOptions.
    if (isTestHarness(file)) continue;
    if (!source.includes('firebase-functions/v1')) continue;
    GEN1_DECLARATION.lastIndex = 0;
    let decl;
    while ((decl = GEN1_DECLARATION.exec(source)) !== null) {
        const runWithBody = decl[1] || '';
        if (/\bmemory\s*:/.test(runWithBody)) continue;
        unpinnedGen1.push({
            file: rel,
            line: source.slice(0, decl.index).split('\n').length,
            trigger: decl[2],
        });
    }
}

if (offenders.length === 0 && unpinnedGen1.length === 0) {
    console.log('✅ No Cloud Function sits below the 512MiB cold-start floor.');
    console.log('   (checked both explicit under-pins and un-pinned Gen1 declarations)');
    process.exit(0);
}

if (offenders.length > 0) {
    console.error(
        `✖ ${offenders.length} Cloud Function(s) pin memory at or below the shared`
        + ' cold-start footprint (~259MiB). Each will OOM before binding port 8080,'
        + ' fail its deploy health check, and fail the entire functions deploy step:\n',
    );
    for (const o of offenders) {
        console.error(`  ${o.file}:${o.line}  [${o.tier}]  ${o.text}`);
    }
    console.error(
        '\nFix: raise to \'512MiB\' or higher. On a Gen1 declaration do NOT simply'
        + ' delete the option — see below for why that does not inherit the global.',
    );
}

if (unpinnedGen1.length > 0) {
    console.error(
        `\n✖ ${unpinnedGen1.length} Gen1 trigger(s) set no \`memory\` at all and therefore run at`
        + ` ${GEN1_DEFAULT_MEMORY}, below the ~259MiB floor.`
        + '\n  `setGlobalOptions({ memory: \'512MiB\' })` in packages/firebase/src/index.ts is'
        + '\n  imported from firebase-functions/v2 and does NOT apply to these:\n',
    );
    for (const u of unpinnedGen1) {
        console.error(`  ${u.file}:${u.line}  [${u.trigger}]  no memory -> ${GEN1_DEFAULT_MEMORY}`);
    }
    console.error(
        '\nFix, in preference order:'
        + '\n  1. Migrate the declaration to firebase-functions/v2 (ISSUE-1243). It then'
        + '\n     inherits the 512MiB global and this whole class disappears.'
        + '\n  2. If it must stay on Gen1, pin it explicitly: .runWith({ memory: \'512MB\' }).',
    );
}

process.exit(1);
