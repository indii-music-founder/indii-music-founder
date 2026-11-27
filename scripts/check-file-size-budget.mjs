#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FILE_SIZE_LIMIT = 1000;
export const ALLOWLIST_REL_PATH = 'scripts/file-size-budget.allowlist.json';

const EXCLUDED_PATTERNS = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /(^|\/)__tests__\//,
    /\.d\.ts$/,
    /\.generated\.[jt]sx?$/,
];

export function isEligibleSourceFile(repoRelPath) {
    if (!/^packages\/[^/]+\/src\/.+\.tsx?$/.test(repoRelPath)) return false;
    return !EXCLUDED_PATTERNS.some((re) => re.test(repoRelPath));
}

export function countLines(text) {
    if (!text) return 0;
    const matches = text.match(/\n/g);
    return matches ? matches.length : 0;
}

/**
 * Pure ratchet evaluator:
 * - Non-allowlisted file > limit -> newOversized
 * - Allowlisted file > allowlist[path] -> grew
 * - Allowlisted file missing or <= limit -> stale
 */
export function evaluateFileSizeBudget(fileLineCounts, allowlist, limit = FILE_SIZE_LIMIT) {
    const newOversized = [];
    const grew = [];
    const stale = [];

    const allPaths = Object.keys(fileLineCounts).sort();
    for (const filePath of allPaths) {
        const lines = fileLineCounts[filePath];
        const cap = Object.prototype.hasOwnProperty.call(allowlist, filePath)
            ? allowlist[filePath]
            : undefined;

        if (cap === undefined) {
            if (lines > limit) {
                newOversized.push({ path: filePath, lines, limit });
            }
        } else {
            if (lines > cap) {
                grew.push({ path: filePath, lines, maxLines: cap });
            } else if (lines <= limit) {
                stale.push({ path: filePath, lines, maxLines: cap, reason: 'now_within_limit' });
            }
        }
    }

    const allowlistedPaths = Object.keys(allowlist).sort();
    for (const filePath of allowlistedPaths) {
        if (!Object.prototype.hasOwnProperty.call(fileLineCounts, filePath)) {
            stale.push({ path: filePath, lines: 0, maxLines: allowlist[filePath], reason: 'deleted' });
        }
    }

    const ok = newOversized.length === 0 && grew.length === 0 && stale.length === 0;
    return { ok, newOversized, grew, stale };
}

export function buildAllowlist(fileLineCounts, limit = FILE_SIZE_LIMIT) {
    const allowlist = {};
    for (const filePath of Object.keys(fileLineCounts).sort()) {
        const lines = fileLineCounts[filePath];
        if (lines > limit) {
            allowlist[filePath] = lines;
        }
    }
    return allowlist;
}

function collectTrackedLineCounts(repoRoot) {
    const stdout = execFileSync(
        'git',
        ['ls-files', 'packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
        { cwd: repoRoot, encoding: 'utf8' },
    );
    const files = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter((f) => f && isEligibleSourceFile(f))
        .sort();

    const counts = {};
    for (const filePath of files) {
        const content = readFileSync(join(repoRoot, filePath), 'utf8');
        counts[filePath] = countLines(content);
    }
    return counts;
}

function runCli() {
    const repoRoot = process.cwd();
    const allowlistPath = join(repoRoot, ALLOWLIST_REL_PATH);
    const writeMode = process.argv.includes('--write');

    const fileLineCounts = collectTrackedLineCounts(repoRoot);

    if (writeMode) {
        const generated = buildAllowlist(fileLineCounts, FILE_SIZE_LIMIT);
        writeFileSync(allowlistPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
        console.log(
            `Wrote ${Object.keys(generated).length} entries to ${ALLOWLIST_REL_PATH} (limit: ${FILE_SIZE_LIMIT} lines).`,
        );
        return;
    }

    const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
    const report = evaluateFileSizeBudget(fileLineCounts, allowlist, FILE_SIZE_LIMIT);

    if (!report.ok) {
        console.error(`File-size budget check failed (limit: ${FILE_SIZE_LIMIT} lines):`);
        for (const item of report.newOversized) {
            console.error(`  [NEW OVERSIZED] ${item.path}: ${item.lines} lines (limit ${item.limit})`);
        }
        for (const item of report.grew) {
            console.error(
                `  [GREW] ${item.path}: ${item.lines} lines > allowlisted ${item.maxLines} (file grew; split it or reduce it)`,
            );
        }
        for (const item of report.stale) {
            const detail = item.reason === 'deleted' ? 'file deleted' : `${item.lines} lines <= ${FILE_SIZE_LIMIT}`;
            console.error(
                `  [STALE] ${item.path}: ${detail} (remove stale allowlist entry)`,
            );
        }
        process.exit(1);
    }

    console.log(
        `File-size budget OK: ${Object.keys(fileLineCounts).length} source files checked, ${Object.keys(allowlist).length} allowlisted (limit: ${FILE_SIZE_LIMIT} lines).`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runCli();
}
