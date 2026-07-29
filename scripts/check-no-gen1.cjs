#!/usr/bin/env node
/**
 * Enforce that no Gen1 Cloud Functions surface survives in the backend source
 * (ISSUE-1243). The migration reached zero; this keeps it there.
 *
 * Why a guard rather than a one-time sweep: the previous Gen1/Gen2 split was
 * never a decision, it was accretion. The codebase began on
 * `firebase-functions/v1`, new work went to v2, and nobody re-checked. Four
 * production divergences grew out of that split, including the ISSUE-1242
 * outage. Nothing in typecheck, lint or the test suite objects to a new v1
 * import, so without this check the split simply reappears.
 *
 * What it rejects, in implementation AND test source:
 *   1. any `firebase-functions/v1` import or require
 *   2. v1 builder chains (`functions.https.onCall`, `.runWith(...).https`,
 *      `functions.firestore.document(...)`, `functions.pubsub.schedule(...)`,
 *      `functions.storage.object()`, `.onRun(`)
 *   3. the v1-only middleware helpers removed by the migration
 *   4. `vi.mock('firebase-functions/v1', ...)` left behind in tests
 *
 * What it must NOT reject:
 *   - legitimate v2 namespace imports (`firebase-functions/v2`,
 *     `firebase-functions/v2/https`, `/firestore`, `/scheduler`, `/storage`)
 *   - `firebase-functions/params`, which is generation-neutral
 *   - the string "v1" in unrelated contexts (API versions, CWR v2.1, DDEX,
 *     model names), which is why every pattern below is anchored to a
 *     functions-specific token rather than a bare version string
 *
 * Usage: node scripts/check-no-gen1.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'packages', 'firebase', 'src');

/**
 * Each rule is anchored to a Gen1-specific token. `label` explains the failure
 * in terms of what breaks, not just what matched.
 */
const RULES = [
    {
        label: 'imports firebase-functions/v1',
        // Matches import and require forms, single or double quoted.
        re: /(?:from|require\()\s*['"]firebase-functions\/v1['"]/,
    },
    {
        label: "mocks 'firebase-functions/v1'",
        re: /vi\.mock\(\s*['"]firebase-functions\/v1['"]/,
    },
    {
        label: 'uses a v1 builder chain (functions.<provider>.<trigger>)',
        re: /\bfunctions\s*\.\s*(?:firestore\s*\.\s*document|pubsub\s*\.\s*(?:schedule|topic)|storage\s*\.\s*(?:object|bucket)|auth\s*\.\s*user|analytics\s*\.\s*event)\b/,
        // `functions.https.onCall` is NOT listed here: it is ambiguous. A file
        // doing `import * as functions from 'firebase-functions/v2'` uses that
        // exact spelling for a perfectly good v2 callable — see
        // functions/billing/enforceOperationCost.ts, whose handlers take
        // CallableRequest. The v1-namespace form is caught by the import rule
        // above, which is unambiguous. The providers listed here have no v2
        // namespace equivalent, so they can only be v1.
    },
    {
        label: 'uses the v1 .runWith() builder',
        // v2 has no runWith — options are the first argument to the factory.
        re: /\bfunctions\s*(?:\.\s*region\([^)]*\)\s*)?\.\s*runWith\s*\(/,
    },
    {
        label: 'uses the v1 scheduler terminal .onRun()',
        re: /\.\s*timeZone\s*\([^)]*\)\s*\.\s*onRun\s*\(|\bschedule\([^)]*\)[\s\S]{0,80}?\.onRun\s*\(/,
    },
    {
        label: 'references a v1-only middleware helper removed by ISSUE-1243',
        re: /\b(?:validateAppCheckV1|requireVerifiedEmailV1|requireVerifiedCreativeAdmissionV1)\b/,
    },
    {
        label: 'references the v1 CallableContext type',
        // v2 handlers receive CallableRequest. CallableContext is v1-only, so
        // its presence means a handler signature was left behind.
        re: /\bCallableContext\b/,
    },
];

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules') continue;
            walk(full, out);
        } else if (entry.name.endsWith('.ts')) {
            // Deliberately includes *.test.ts: a v1 mock left in a test file is
            // exactly the residue this guard exists to catch.
            out.push(full);
        }
    }
    return out;
}

const findings = [];
for (const file of walk(ROOT)) {
    const rel = path.relative(path.resolve(__dirname, '..'), file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
        // Skip comment-only lines: this file's own history is documented in
        // prose that legitimately names the old v1 symbols.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const rule of RULES) {
            if (rule.re.test(line)) {
                findings.push({ file: rel, line: index + 1, label: rule.label, text: trimmed.slice(0, 100) });
            }
        }
    });
}

if (findings.length === 0) {
    console.log('✅ No Gen1 Cloud Functions surface in packages/firebase/src (implementation or tests).');
    process.exit(0);
}

console.error(
    `✖ ${findings.length} Gen1 reference(s) found. The backend completed its Gen2 migration`
    + ' under ISSUE-1243; reintroducing Gen1 re-opens the split that produced the'
    + ' ISSUE-1242 outage:\n',
);
for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.label}`);
    console.error(`      ${f.text}`);
}
console.error(
    '\nUse the v2 entry points instead:'
    + "\n  callables/HTTP  import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'"
    + "\n  firestore       import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'"
    + "\n  scheduled       import { onSchedule } from 'firebase-functions/v2/scheduler'"
    + "\n  storage         import { onObjectFinalized } from 'firebase-functions/v2/storage'"
    + "\n  handler param   CallableRequest, not CallableContext"
    + '\nNew v2 exports must also satisfy scripts/check-gen2-migration-semantics.cjs.',
);
process.exit(1);
