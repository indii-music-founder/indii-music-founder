#!/usr/bin/env node
/**
 * Dependency Integrity Check — undeclared-dependency detector
 *
 * Complements scripts/check-dep-version-drift.cjs, which walks FROM package.json
 * outward (declared range vs. what's installed). This script walks the OTHER
 * direction: FROM source code inward — for every workspace, it scans actual
 * import/require statements and flags any package that source code depends on
 * but that isn't declared in that workspace's own package.json OR the root
 * package.json (npm workspaces legitimately hoist shared devDependencies like
 * `vitest`/`typescript` to the root only — that is normal, not a violation).
 *
 * Why this exists (ISSUE-1198, 2026-07-22): `motion` was imported by 176 files
 * in packages/renderer/src but was not declared in packages/renderer/package.json
 * (nor the root). `npm run typecheck` and `npm run lint` both passed cleanly,
 * because both read types/lint straight from whatever happens to be sitting in
 * node_modules, regardless of what any package.json declares. The break was
 * invisible until a real `npm ci` / `npm prune` / CI cache miss pruned the
 * undeclared package — at which point all 176 files would have failed at
 * runtime. Neither the existing drift checker nor typecheck/lint can catch this
 * class of bug by construction; only a source-vs-manifest import scan can.
 *
 * Exit code 0 = clean, 1 = undeclared dependencies found.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const rootManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const workspaceGlobs = rootManifest.workspaces || [];
const packageDirs = workspaceGlobs
    .map((p) => p.replace(/^packages\//, ''))
    .filter((p) => !p.includes('*'));

const rootDeclared = new Set(Object.keys({
    ...(rootManifest.dependencies || {}),
    ...(rootManifest.devDependencies || {}),
}));

// Node built-ins never need a package.json entry.
const NODE_BUILTINS = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
    'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
    'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls',
    'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

// tsconfig.json "paths" aliases resolve to source directories, not npm packages.
// Read them from the root tsconfig so this doesn't silently drift out of sync.
let pathAliasPrefixes = ['@/'];
try {
    const tsconfigRaw = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8')
        // strip // line comments and /* */ block comments so JSON.parse doesn't choke on tsconfig's JSONC
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    const tsconfig = JSON.parse(tsconfigRaw);
    const paths = tsconfig.compilerOptions && tsconfig.compilerOptions.paths;
    if (paths) {
        for (const key of Object.keys(paths)) {
            // "@agents/*" -> "@agents/", "@indii/shared" (no wildcard) -> exact-match handled separately
            pathAliasPrefixes.push(key.replace(/\*$/, ''));
        }
    }
} catch {
    // fall back to just '@/' if tsconfig can't be read/parsed
}

function isPathAlias(source) {
    return pathAliasPrefixes.some((prefix) => source === prefix.replace(/\/$/, '') || source.startsWith(prefix));
}

function isSkippable(source) {
    if (source.startsWith('.') || source.startsWith('/')) return true;
    if (source.startsWith('node:')) return true;
    if (isPathAlias(source)) return true;
    if (/\.(css|scss|less|svg|png|jpg|jpeg|gif|webp|json|wasm)(\?|$)/.test(source)) return true;
    if (source.startsWith('virtual:') || source.startsWith('vite/')) return true;
    return false;
}

// Extract the base npm package name from an import specifier, respecting scopes
// and subpath imports: '@scope/pkg/sub/path' -> '@scope/pkg', 'pkg/sub' -> 'pkg'.
function toPackageName(source) {
    const parts = source.split('/');
    if (source.startsWith('@')) return parts.slice(0, 2).join('/');
    return parts[0];
}

// Three distinct, narrowly-bounded patterns instead of one greedy one:
//  1. dynamic import:      import('pkg')
//  2. side-effect import:  import 'pkg';
//  3. static import/export with a from-clause, bounded to NOT cross a ';' —
//     this is what prevents matching a bare `export interface Foo { ... }`
//     against some unrelated string literal many lines later in the file.
//  4. require('pkg')
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_RE = /\bimport\s+['"]([^'"]+)['"]/g;
const FROM_CLAUSE_RE = /\b(?:import|export)\b[^;]*?\bfrom\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

const SOURCE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '_archive_legacy']);

function walkSourceFiles(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkSourceFiles(full, out);
        } else if (SOURCE_EXT_RE.test(entry.name)) {
            out.push(full);
        }
    }
}

// Strips // line comments and /* */ block comments while leaving string/template
// literal *contents* untouched (so a URL like "http://x" inside a real string is
// never mistaken for a comment start). Not a full tokenizer, but good enough for
// import-statement scanning: a commented-out `// import 'pkg'` must not count as
// real usage — that produced a false positive (a stale `next` import comment in
// packages/landing) on this checker's very first real run.
function stripComments(code) {
    return code.replace(
        /("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(`(?:[^`\\]|\\.)*`)|(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm,
        (match, dq, sq, tpl, lineComment, blockComment) => {
            if (lineComment || blockComment) return '';
            return match;
        }
    );
}

function extractImportSources(rawContent) {
    const content = stripComments(rawContent);
    const sources = [];
    for (const re of [DYNAMIC_IMPORT_RE, SIDE_EFFECT_IMPORT_RE, FROM_CLAUSE_RE, REQUIRE_RE]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content)) !== null) {
            sources.push(match[1]);
        }
    }
    return sources;
}

let totalViolations = 0;

for (const pkg of packageDirs) {
    const pkgDir = path.join(ROOT, 'packages', pkg);
    const manifestPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const declared = new Set(Object.keys({
        ...(manifest.dependencies || {}),
        ...(manifest.devDependencies || {}),
        ...(manifest.peerDependencies || {}),
        ...(manifest.optionalDependencies || {}),
    }));
    const selfName = manifest.name;

    const srcDir = fs.existsSync(path.join(pkgDir, 'src')) ? path.join(pkgDir, 'src') : pkgDir;
    const files = [];
    walkSourceFiles(srcDir, files);

    const usedBy = new Map(); // package name -> up to 3 relative file paths that import it

    for (const file of files) {
        let content;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const source of extractImportSources(content)) {
            if (!source || isSkippable(source)) continue;
            const pkgName = toPackageName(source);
            if (NODE_BUILTINS.has(pkgName)) continue;
            if (pkgName === selfName) continue;
            if (declared.has(pkgName)) continue;
            if (rootDeclared.has(pkgName)) continue; // legitimately hoisted from the root manifest

            const rel = path.relative(ROOT, file);
            if (!usedBy.has(pkgName)) usedBy.set(pkgName, []);
            const list = usedBy.get(pkgName);
            if (list.length < 3) list.push(rel);
        }
    }

    if (usedBy.size > 0) {
        console.log(`\n❌ ${pkg} (${path.relative(ROOT, manifestPath)}) — imported but not declared (workspace or root):`);
        for (const [pkgName, files_] of [...usedBy.entries()].sort()) {
            console.log(`   ${pkgName}  (e.g. ${files_.join(', ')}${files_.length === 3 ? ', ...' : ''})`);
            totalViolations++;
        }
    }
}

if (totalViolations === 0) {
    console.log('✅ Dependency integrity check: clean — every imported package is declared where it is used.');
    process.exit(0);
} else {
    console.log(`\n❌ Found ${totalViolations} undeclared dependency violation(s) across the workspace.`);
    console.log('Fix: add each package to the correct workspace\'s package.json (dependencies, unless it is');
    console.log('genuinely dev/test-only), then run npm install to sync the lockfile. Do not assume a package');
    console.log('is safe just because typecheck/lint pass — both read straight from node_modules regardless');
    console.log('of what package.json declares, so this class of bug is invisible to them by construction.');
    process.exit(1);
}
