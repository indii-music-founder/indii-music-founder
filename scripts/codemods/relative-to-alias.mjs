#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const RENDERER_PREFIX = 'packages/renderer/src/';
const SHARED_PREFIX = 'packages/shared/src/';

const RESOLVE_EXTENSIONS = [
    '',
    '.ts',
    '.tsx',
    '.d.ts',
    '.mts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.css',
    '/index.ts',
    '/index.tsx',
    '/index.d.ts',
    '/index.js',
    '/index.mjs',
];

function defaultFileExists(repoRoot, repoRelPath) {
    const abs = join(repoRoot, repoRelPath);
    try {
        return existsSync(abs) && statSync(abs).isFile();
    } catch {
        return false;
    }
}

/**
 * Resolves a relative specifier from a repo-relative file path to `@/...` or `@shared/...`.
 * Returns:
 * - { status: 'rewritten', replacement }
 * - { status: 'cross_package', resolved }
 * - { status: 'unresolved', resolved }
 */
export function resolveRelativeSpecifier(
    fromRepoRelPath,
    specifier,
    { repoRoot = process.cwd(), fileExists = defaultFileExists } = {},
) {
    const qIdx = specifier.indexOf('?');
    const rawPath = qIdx === -1 ? specifier : specifier.slice(0, qIdx);
    const query = qIdx === -1 ? '' : specifier.slice(qIdx);

    const fromDir = posix.dirname(fromRepoRelPath);
    // Normalize trailing slash (e.g. `./` -> directory itself)
    const joined = posix.normalize(posix.join(fromDir, rawPath));
    const normalized = joined.endsWith('/') ? joined.slice(0, -1) : joined;

    const exists = RESOLVE_EXTENSIONS.some((ext) => fileExists(repoRoot, `${normalized}${ext}`));
    if (!exists) {
        return { status: 'unresolved', resolved: normalized };
    }

    if (normalized.startsWith(RENDERER_PREFIX)) {
        const sub = normalized.slice(RENDERER_PREFIX.length);
        return { status: 'rewritten', replacement: `@/${sub}${query}` };
    }
    if (normalized.startsWith(SHARED_PREFIX)) {
        const sub = normalized.slice(SHARED_PREFIX.length);
        return { status: 'rewritten', replacement: `@shared/${sub}${query}` };
    }
    return { status: 'cross_package', resolved: normalized };
}

/**
 * Rewrites relative module specifiers in TS/TSX source for:
 * - static import/export `from './...'` / `from '../...'`
 * - bare side-effect `import './...'` / `import '../...'`
 * - dynamic `import('./...')` / `import('../...')`
 * - vitest `vi.mock('...')`, `vi.doMock('...')`, `vi.importActual('...')` (with optional generic `<...>`)
 *
 * Skips line/block comments, template literals, `new URL(..., import.meta.url)`, and `import.meta.glob`.
 */
export function rewriteSource(source, fromRepoRelPath, options = {}) {
    const n = source.length;
    let i = 0;
    let out = '';
    const rewritten = [];
    const unresolved = [];
    const crossPackage = [];

    function lineAt(pos) {
        let line = 1;
        for (let k = 0; k < pos; k++) {
            if (source[k] === '\n') line++;
        }
        return line;
    }

    function readStringLiteral(startIdx) {
        const quote = source[startIdx];
        let j = startIdx + 1;
        while (j < n) {
            if (source[j] === '\\') {
                j += 2;
                continue;
            }
            if (source[j] === quote) {
                return { quote, value: source.slice(startIdx + 1, j), end: j + 1 };
            }
            if (source[j] === '\n' && quote !== '`') break;
            j++;
        }
        return null;
    }

    function skipWsAndComments(idx) {
        let j = idx;
        while (j < n) {
            const ch = source[j];
            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
                j++;
            } else if (ch === '/' && source[j + 1] === '/') {
                while (j < n && source[j] !== '\n') j++;
            } else if (ch === '/' && source[j + 1] === '*') {
                j += 2;
                while (j < n && !(source[j] === '*' && source[j + 1] === '/')) j++;
                j += 2;
            } else {
                break;
            }
        }
        return j;
    }

    function skipBalancedAngles(idx) {
        if (source[idx] !== '<') return idx;
        let depth = 0;
        let j = idx;
        while (j < n) {
            const ch = source[j];
            if (ch === '<') depth++;
            else if (ch === '>') {
                depth--;
                if (depth === 0) return j + 1;
            }
            j++;
        }
        return idx;
    }

    function tryRewriteLiteralAt(litStart, kind) {
        const q = source[litStart];
        if (q !== "'" && q !== '"') return null;
        const str = readStringLiteral(litStart);
        if (!str) return null;
        if (!str.value.startsWith('./') && !str.value.startsWith('../')) return null;

        const res = resolveRelativeSpecifier(fromRepoRelPath, str.value, options);
        if (res.status === 'rewritten') {
            rewritten.push({ kind, line: lineAt(litStart), from: str.value, to: res.replacement });
            return {
                replacement: `${str.quote}${res.replacement}${str.quote}`,
                end: str.end,
            };
        }
        if (res.status === 'cross_package') {
            crossPackage.push({ kind, line: lineAt(litStart), specifier: str.value, resolved: res.resolved });
        } else {
            unresolved.push({ kind, line: lineAt(litStart), specifier: str.value, resolved: res.resolved });
        }
        return { replacement: source.slice(litStart, str.end), end: str.end };
    }

    while (i < n) {
        const ch = source[i];

        // Skip comments verbatim
        if (ch === '/' && source[i + 1] === '/') {
            const start = i;
            while (i < n && source[i] !== '\n') i++;
            out += source.slice(start, i);
            continue;
        }
        if (ch === '/' && source[i + 1] === '*') {
            const start = i;
            i += 2;
            while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
            i = Math.min(n, i + 2);
            out += source.slice(start, i);
            continue;
        }

        // Skip string/template literals verbatim (not preceded by matched keyword)
        if (ch === "'" || ch === '"' || ch === '`') {
            const start = i;
            const str = readStringLiteral(i);
            if (str) {
                out += source.slice(start, str.end);
                i = str.end;
            } else {
                out += ch;
                i++;
            }
            continue;
        }

        // Identifiers / keywords
        if (/[A-Za-z_$]/.test(ch)) {
            const prev = i > 0 ? source[i - 1] : '';
            const start = i;
            while (i < n && /[A-Za-z0-9_$]/.test(source[i])) i++;
            const ident = source.slice(start, i);

            // 1. `from './...'` (static import/export)
            if (ident === 'from' && !/[A-Za-z0-9_$.]/.test(prev)) {
                const litIdx = skipWsAndComments(i);
                const hit = tryRewriteLiteralAt(litIdx, 'static_from');
                if (hit) {
                    out += source.slice(start, litIdx) + hit.replacement;
                    i = hit.end;
                    continue;
                }
            }

            // 2. `import './...'` (bare) or `import('./...')` (dynamic)
            if (ident === 'import' && !/[A-Za-z0-9_$.]/.test(prev)) {
                const nextIdx = skipWsAndComments(i);
                if (source[nextIdx] === "'" || source[nextIdx] === '"') {
                    const hit = tryRewriteLiteralAt(nextIdx, 'bare_import');
                    if (hit) {
                        out += source.slice(start, nextIdx) + hit.replacement;
                        i = hit.end;
                        continue;
                    }
                } else if (source[nextIdx] === '(') {
                    const litIdx = skipWsAndComments(nextIdx + 1);
                    const hit = tryRewriteLiteralAt(litIdx, 'dynamic_import');
                    if (hit) {
                        out += source.slice(start, litIdx) + hit.replacement;
                        i = hit.end;
                        continue;
                    }
                }
            }

            // 3. `vi.mock('...')`, `vi.doMock('...')`, `vi.importActual('...')`
            if (ident === 'vi' && !/[A-Za-z0-9_$.]/.test(prev) && source[i] === '.') {
                let mIdx = i + 1;
                const mStart = mIdx;
                while (mIdx < n && /[A-Za-z0-9_$]/.test(source[mIdx])) mIdx++;
                const method = source.slice(mStart, mIdx);
                if (method === 'mock' || method === 'doMock' || method === 'importActual') {
                    let afterMethod = skipWsAndComments(mIdx);
                    let genericPrefix = source.slice(start, afterMethod);
                    if (source[afterMethod] === '<') {
                        const angleEnd = skipBalancedAngles(afterMethod);
                        const innerRes = rewriteSource(
                            source.slice(afterMethod, angleEnd),
                            fromRepoRelPath,
                            options,
                        );
                        rewritten.push(...innerRes.rewritten);
                        unresolved.push(...innerRes.unresolved);
                        crossPackage.push(...innerRes.crossPackage);
                        const afterAngles = skipWsAndComments(angleEnd);
                        genericPrefix += innerRes.code + source.slice(angleEnd, afterAngles);
                        afterMethod = afterAngles;
                    }
                    if (source[afterMethod] === '(') {
                        const litIdx = skipWsAndComments(afterMethod + 1);
                        const hit = tryRewriteLiteralAt(litIdx, `vi.${method}`);
                        if (hit) {
                            out += genericPrefix + source.slice(afterMethod, litIdx) + hit.replacement;
                            i = hit.end;
                            continue;
                        }
                    }
                }
            }

            out += ident;
            continue;
        }

        out += ch;
        i++;
    }

    return {
        code: out,
        changed: out !== source,
        rewritten,
        unresolved,
        crossPackage,
    };
}

function runCli() {
    const repoRoot = process.cwd();
    const writeMode = process.argv.includes('--write');

    const stdout = execFileSync(
        'git',
        [
            'ls-files',
            'packages/renderer/src/*.ts',
            'packages/renderer/src/*.tsx',
            'packages/renderer/src/**/*.ts',
            'packages/renderer/src/**/*.tsx',
        ],
        { cwd: repoRoot, encoding: 'utf8' },
    );
    const files = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .sort();

    let filesChanged = 0;
    let totalRewritten = 0;
    const allUnresolved = [];
    const allCrossPackage = [];

    for (const file of files) {
        const abs = join(repoRoot, file);
        const orig = readFileSync(abs, 'utf8');
        const res = rewriteSource(orig, file, { repoRoot });
        if (res.changed) {
            filesChanged++;
            totalRewritten += res.rewritten.length;
            if (writeMode) {
                writeFileSync(abs, res.code, 'utf8');
            }
        }
        for (const u of res.unresolved) {
            allUnresolved.push({ file, ...u });
        }
        for (const c of res.crossPackage) {
            allCrossPackage.push({ file, ...c });
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: writeMode ? 'write' : 'dry-run',
                filesScanned: files.length,
                filesChanged,
                totalRewritten,
                crossPackageCount: allCrossPackage.length,
                unresolvedCount: allUnresolved.length,
                crossPackage: allCrossPackage,
                unresolved: allUnresolved,
            },
            null,
            2,
        ),
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runCli();
}
