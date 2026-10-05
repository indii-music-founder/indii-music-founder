const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'bundled-mcp');

// These packages contain runtime files (PDF workers/fonts and native binaries)
// whose relative paths must survive packaging. Everything else is bundled.
async function copyRuntimePackage(name, from, destination, copied) {
    const resolveFrom = createRequire(path.join(from, 'package.json'));
    const manifestPath = resolveFrom.resolve(`${name}/package.json`);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (copied.has(name)) {
        if (copied.get(name) !== manifest.version) {
            throw new Error(`Conflicting bundled runtime versions for ${name}`);
        }
        return;
    }
    copied.set(name, manifest.version);
    const packageRoot = path.dirname(manifestPath);
    await fs.cp(packageRoot, path.join(destination, 'node_modules', name), {
        recursive: true, dereference: true,
    });
    for (const dependency of Object.keys(manifest.dependencies || {})) {
        await copyRuntimePackage(dependency, packageRoot, destination, copied);
    }
    for (const dependency of Object.keys(manifest.optionalDependencies || {})) {
        // Only the installed platform's optional native binaries are present.
        try { resolveFrom.resolve(`${dependency}/package.json`); }
        catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') continue;
            throw error;
        }
        await copyRuntimePackage(dependency, packageRoot, destination, copied);
    }
}

async function buildBundledMcp() {
    await fs.rm(output, { recursive: true, force: true });
    for (const name of ['local', 'harness']) {
        const destination = path.join(output, name);
        await fs.mkdir(path.join(destination, 'dist'), { recursive: true });
        await fs.writeFile(path.join(destination, 'package.json'), JSON.stringify({
            name: `indii-bundled-mcp-${name}`, private: true, type: 'commonjs',
        }));
        await build({
            absWorkingDir: root,
            entryPoints: [`packages/mcp-server-${name}/src/index.ts`],
            outfile: path.join(destination, 'dist', 'index.js'),
            bundle: true, platform: 'node', format: 'cjs', target: 'node22',
            external: ['pdfjs-dist', 'ffprobe-static'],
        });
        if (name === 'local') {
            // Bundled executor's __dirname is dist, so keep its Python entry
            // point and all imported templates beside the bundled server.
            await fs.cp(path.join(root, 'packages/mcp-server-local/src/blender/python'),
                path.join(destination, 'dist', 'python'), { recursive: true });
            const copied = new Map();
            for (const dependency of ['pdfjs-dist', 'ffprobe-static']) {
                await copyRuntimePackage(dependency, root, destination, copied);
            }
        }
    }
}

// electron-builder awaits this hook before collecting extraResources.
exports.default = buildBundledMcp;
if (require.main === module) {
    buildBundledMcp().catch(error => { console.error(error); process.exitCode = 1; });
}
