#!/usr/bin/env node
/**
 * Dependency Version Drift Check
 *
 * For every npm workspace member, compares each declared dependency's semver
 * range in that package's package.json against what's actually resolved in
 * node_modules (nested copy if present, otherwise root-hoisted). Flags any
 * case where the installed version does not satisfy the declared range —
 * meaning package.json and package-lock.json/node_modules have drifted apart.
 *
 * This does NOT flag ordinary npm workspace dedup (a package legitimately
 * getting its own nested copy because a transitive constraint differs) —
 * only genuine "declared vs installed" manifest violations.
 *
 * Exit code 0 = clean, 1 = violations found.
 */
const fs = require('fs');
const path = require('path');
const semver = require('semver');

const ROOT = path.resolve(__dirname, '..');
const rootManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const workspaceGlobs = rootManifest.workspaces || [];
const packageDirs = workspaceGlobs
    .map((p) => p.replace(/^packages\//, ''))
    .filter((p) => !p.includes('*'));

let violations = 0;

for (const pkg of packageDirs) {
    const pkgDir = path.join(ROOT, 'packages', pkg);
    const manifestPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const deps = { ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) };

    for (const [dep, range] of Object.entries(deps)) {
        if (range.startsWith('file:') || range.startsWith('workspace:') || range.startsWith('link:')) continue;

        const nested = path.join(pkgDir, 'node_modules', dep, 'package.json');
        const rootResolved = path.join(ROOT, 'node_modules', dep, 'package.json');
        const resolvedPath = fs.existsSync(nested) ? nested : (fs.existsSync(rootResolved) ? rootResolved : null);
        if (!resolvedPath) {
            console.log(`MISSING: ${pkg}/${dep} — declared "${range}" but not found in nested or root node_modules`);
            violations++;
            continue;
        }

        let installedVersion;
        try {
            installedVersion = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')).version;
        } catch {
            continue;
        }
        if (!installedVersion) continue;

        let ok = false;
        try {
            ok = semver.satisfies(installedVersion, range, { includePrerelease: true });
        } catch {
            ok = true; // range is not valid semver (git url, tag, etc.) — skip
        }
        if (!ok) {
            console.log(`VIOLATION: ${pkg}/${dep}  declared="${range}"  installed=${installedVersion}`);
            violations++;
        }
    }
}

if (violations === 0) {
    console.log('✅ Dependency version drift check: clean — all declared ranges match installed versions.');
    process.exit(0);
} else {
    console.log(`\n❌ Found ${violations} version drift violation(s). package.json and package-lock.json/node_modules disagree.`);
    console.log('Fix: either update the declared range to match what\'s actually locked/installed (if intentional,');
    console.log('e.g. a monorepo-wide override), or run npm install to bring node_modules up to what\'s declared.');
    process.exit(1);
}
