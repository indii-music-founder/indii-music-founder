#!/usr/bin/env node
/**
 * Guard the runtime semantics of the Gen1 -> Gen2 migration (ISSUE-1243).
 *
 * Moving a trigger from `firebase-functions/v1` to `firebase-functions/v2`
 * silently changes three runtime defaults. None of them produce a type error,
 * a failed test, or a deploy failure — they change behavior in production only.
 *
 *   1. CONCURRENCY. Gen1 serves exactly one request per instance. Gen2 defaults
 *      to 1 CPU with concurrency 80, so a migrated export suddenly shares one
 *      instance — and every module-level value in it — across up to 80
 *      simultaneous requests. Measured on this project's already-migrated
 *      functions: getCustomerPortal, mcpEndpoint and agentStreamResponse all
 *      report maxInstanceRequestConcurrency=80, availableCpu=1.
 *
 *   2. CPU. Gen1 allocates CPU proportional to the memory tier. Gen2 allocates
 *      a full vCPU. `cpu: 'gcf_gen1'` restores the Gen1 ratio, which is both
 *      the documented upgrade path and materially cheaper.
 *
 *   3. MEMORY. This one is deliberately NOT preserved, and that is the whole
 *      point of the exception below. See ISSUE-1242.
 *
 * THE MEMORY EXCEPTION, stated explicitly so nobody "fixes" it later:
 * a Gen1 trigger with no `memory` runs at 256MB, and 256MB is unsafe for this
 * repository's deployed entry graph. That is the proven invariant, established
 * by ISSUE-1242: `generateContentStream` pinned nothing, ran at 256MB, could
 * not complete its outbound Arcjet call under memory pressure, and denied 100%
 * of authenticated AI requests in production. scripts/check-function-memory.cjs
 * documents the same floor (~259MiB shared cold-start footprint) and enforces
 * it. So a migrated export must be at or above 512MiB and must NOT carry its
 * live Gen1 tier forward — preserving 256MB would propagate a known-broken
 * configuration, not preserve behavior. The two guards divide the work: this
 * one requires the tier to be declared, that one requires it to be safe.
 *
 * Usage: node scripts/check-gen2-migration-semantics.cjs
 *
 * NOT wired to CI or pre-commit yet, by decision: it is a companion to
 * check-function-memory.cjs, and both go red until the Gen1 count reaches
 * zero. Wire both in together at the end of the migration rather than
 * knowingly red-gating mainline for everyone else in the meantime.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'packages', 'firebase', 'src');

/**
 * Exports MIGRATED from Gen1 to Gen2 by ISSUE-1243, and only those.
 *
 * Scope matters: this project also has ~85 exports that were BORN as Gen2.
 * Those never had Gen1 semantics to preserve, and pinning them to
 * `concurrency: 1` would REDUCE their throughput from the 80 they run at
 * today. This guard must never touch them, which is why membership is an
 * explicit list rather than "every v2 export".
 *
 * SCOPE: this is the source/runtime-semantics migration inventory. It records
 * which exports changed generation in source and is used only to validate
 * their declared runtime options. It is NOT a cutover manifest and prescribes
 * no deployment procedure. Gen1 -> Gen2 is not an in-place upgrade, so a real
 * cutover needs a separate, generation-aware manifest with validated
 * replacement and rollback evidence per function before anything is removed;
 * that is a founder-gated artifact and does not live here.
 *
 * Two facts this inventory does record, because they are measured and a
 * cutover plan will need them:
 *   - Every entry was confirmed deployed in us-central1 via
 *     `gcloud functions describe <name> --region us-central1`.
 *   - Invoker bindings differ by generation. Gen1 grants
 *     `roles/cloudfunctions.invoker` on the function; Gen2 grants
 *     `roles/run.invoker` on the backing Cloud Run service. Verified here:
 *     createStripeAccount holds cloudfunctions.invoker/allUsers,
 *     getCustomerPortal holds run.invoker/allUsers.
 */
const MIGRATED = [
    // security + distribution callables
    'logAuditEvent', 'persistFraudAlert',
    'registerAiContextCache', 'recordInstrumentUsage',
    'assignDistributionIdentifier', 'recordDistributionIdentifier',
    'recordDistributionAuditEvent', 'requestDistributionTakedown',
    'createSftpIngestionRecord', 'updateSftpIngestionRecord',
    // timeline trigger + social + studio relay
    'onMilestoneScheduled', 'refreshSocialToken',
    'issueStudioExecutorLease', 'publishStudioPresence', 'releaseStudioPresence',
    'claimStudioCommand', 'publishStudioResponse', 'completeStudioCommand',
    // release / legal / finance
    'generateReleaseDownloadUrl', 'auditReleaseArtworkForDelivery',
    'verifyMechanicalLicense', 'sendForDigitalSignature', 'requestTaxForms',
    // telegram
    'generateTelegramLinkCode', 'getTelegramLinkStatus',
    // stripe connect / touring / marketing
    'createStripeAccount', 'createStripeConnectAccount', 'createTransfer',
    'generateItinerary', 'checkLogistics', 'findPlaces',
    'executeCampaign', 'dispatchSocialPost', 'createInfluencerBounty',
    // bug reporting / analytics OAuth token exchange
    'reportBugFn',
    'analyticsExchangeToken', 'analyticsFinalizeInstagramConnection',
    'analyticsGetConnectionStatus', 'analyticsRefreshToken', 'analyticsRevokeToken',
    // email OAuth token manager / PandaDoc proxy
    'emailExchangeToken', 'emailRefreshToken', 'emailRevokeToken',
    'pandadocListTemplates', 'pandadocCreateDocument', 'pandadocSendDocument',
    'pandadocGetDocumentStatus', 'pandadocGetSigningLink',
    // scheduled storage maintenance / relay command trigger
    'cleanupOrphanedVideos', 'trackStorageQuotas',
    'cleanupExpiredVideoTemps', 'flagVideosForArchival',
    'processRelayCommand',
    // inbound webhooks / split escrow
    'pandadocWebhook', 'telegramWebhook',
    'initiateSplitEscrow', 'signEscrow', 'releaseEscrow',
];
const MIGRATED_SET = new Set(MIGRATED);

/** v2 trigger factories whose declarations carry runtime options. */
const V2_FACTORIES = [
    'onCall', 'onRequest',
    'onDocumentWritten', 'onDocumentCreated', 'onDocumentUpdated', 'onDocumentDeleted',
    'onObjectFinalized', 'onObjectArchived', 'onObjectDeleted', 'onObjectMetadataUpdated',
    'onSchedule', 'onTaskDispatched', 'onMessagePublished',
];

/**
 * Memory tiers at or above the ~259MiB shared cold-start floor. Presence of a
 * `memory` key is not sufficient — `memory: '256MiB'` would satisfy a
 * key-presence check and still OOM on every cold start.
 */
const SAFE_MEMORY = new Set([
    '512MiB', '1GiB', '2GiB', '4GiB', '8GiB', '16GiB', '32GiB',
]);

/**
 * Each rule reads the options literal and returns null when satisfied, or a
 * human-readable reason when not. Values are checked, not just key presence.
 */
const RULES = [
    {
        key: 'memory',
        check: (opts) => {
            const m = opts.match(/\bmemory\s*:\s*['"]([^'"]+)['"]/);
            if (!m) return 'memory not declared';
            if (!SAFE_MEMORY.has(m[1])) {
                return `memory '${m[1]}' is below the 512MiB cold-start floor (ISSUE-1242)`;
            }
            return null;
        },
    },
    {
        key: 'cpu',
        check: (opts) => {
            const m = opts.match(/\bcpu\s*:\s*['"]([^'"]+)['"]/);
            if (!m) return 'cpu not declared';
            if (m[1] !== 'gcf_gen1') return `cpu '${m[1]}' does not preserve the Gen1 ratio`;
            return null;
        },
    },
    {
        key: 'concurrency',
        check: (opts) => {
            const m = opts.match(/\bconcurrency\s*:\s*(\d+)/);
            if (!m) return 'concurrency not declared';
            if (m[1] !== '1') return `concurrency ${m[1]} is not Gen1 one-request-per-instance`;
            return null;
        },
    },
];

/** `export const name = factory(` — captures the export name and factory. */
const EXPORT_DECL = new RegExp(
    String.raw`export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*(${V2_FACTORIES.join('|')})\s*\(`,
    'g',
);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules') continue;
            walk(full, out);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Read the balanced `{...}` options literal that immediately follows the open
 * paren, if there is one. Returns null when the factory was called with a bare
 * handler or a bare path string (i.e. no options object at all).
 */
function readOptionsLiteral(source, openParenIndex) {
    let i = openParenIndex + 1;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== '{') return null;

    let depth = 0;
    const start = i;
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    return null;
}

const offenders = [];
const seen = new Set();
for (const file of walk(ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    if (file.endsWith(path.join('firebase', 'src', 'test', 'setup.ts'))) continue;

    EXPORT_DECL.lastIndex = 0;
    let match;
    while ((match = EXPORT_DECL.exec(source)) !== null) {
        const [, exportName, factory] = match;
        // Native-Gen2 exports are out of scope — see MIGRATED above.
        if (!MIGRATED_SET.has(exportName)) continue;
        seen.add(exportName);
        const openParen = match.index + match[0].length - 1;
        const options = readOptionsLiteral(source, openParen);
        const problems = options === null
            ? RULES.map((r) => `${r.key} not declared (no options object)`)
            : RULES.map((r) => r.check(options)).filter(Boolean);

        if (problems.length > 0) {
            offenders.push({
                file: path.relative(path.resolve(__dirname, '..'), file),
                line: source.slice(0, match.index).split('\n').length,
                exportName,
                factory,
                problems,
            });
        }
    }
}

// A manifest entry that matches no v2 declaration is either a typo or an
// export still awaiting migration. Either way the manifest is no longer
// authoritative, so say so rather than silently passing.
const unresolved = MIGRATED.filter((name) => !seen.has(name));

if (offenders.length === 0 && unresolved.length === 0) {
    console.log(
        `✅ All ${MIGRATED.length} migrated export(s) declare memory >= 512MiB,`
        + " cpu 'gcf_gen1' and concurrency 1.",
    );
    process.exit(0);
}

if (unresolved.length > 0) {
    console.error(
        `✖ ${unresolved.length} manifest entr(ies) matched no v2 trigger declaration.`
        + ' They are mis-spelled, or still on Gen1 and not yet converted:\n',
    );
    for (const name of unresolved) console.error(`  ${name}`);
    console.error('');
}

if (offenders.length > 0) {
    console.error(
        `✖ ${offenders.length} migrated export(s) do not preserve Gen1 runtime semantics.`
        + ' Each silently differs from its pre-migration behavior in production:\n',
    );
    for (const o of offenders) {
        console.error(`  ${o.file}:${o.line}  ${o.exportName} [${o.factory}]`);
        for (const p of o.problems) console.error(`      - ${p}`);
    }
    console.error(
        "\nFix: declare all three on the export's own options object."
        + "\n  memory      '512MiB' or higher — NOT the live Gen1 256MB value, which"
        + '\n              OOMs against the shared cold-start bundle (ISSUE-1242).'
        + "\n  cpu         'gcf_gen1' to keep the Gen1 CPU-to-memory ratio."
        + '\n  concurrency 1 to keep Gen1 one-request-per-instance semantics.'
        + '\nSet them per export. Do NOT move them into setGlobalOptions — that would'
        + '\nalso re-configure the ~85 functions already running as native Gen2,'
        + '\ncutting their concurrency from 80 to 1.',
    );
}

process.exit(1);
