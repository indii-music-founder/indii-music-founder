const path = require('node:path');
const fs = require('node:fs/promises');

// Inspect the actual app's collected resources, before signing/publishing.
// No renderer/authentication state is injected by this package verification.
exports.default = async context => {
    const resources = context.packager.getResourcesDir(context.appOutDir);
    // electron-builder drops node_modules folders from extraResources even with
    // an explicit filter, so the bundled servers' runtime packages (pdfjs-dist,
    // ffprobe-static, native @napi-rs builds) are copied in here (ISSUE-1718).
    const bundled = path.join(context.packager.projectDir, 'dist', 'bundled-mcp');
    for (const [from, to] of [['local', 'mcp-server-local'], ['harness', 'mcp-server-harness']]) {
        const source = path.join(bundled, from, 'node_modules');
        const exists = await fs.stat(source).then(() => true, () => false);
        if (exists) {
            await fs.cp(source, path.join(resources, to, 'node_modules'), { recursive: true, dereference: true });
        }
    }
    const registry = JSON.parse(await fs.readFile(path.join(resources, 'agents/capability_registry.json'), 'utf8'));
    const { assertPortableAgentRegistry } = require('./portable-agent-registry.cjs');
    assertPortableAgentRegistry(registry);
    const { verifyBundledMcp } = await import('./verify-bundled-mcp.mjs');
    await verifyBundledMcp({
        local: path.join(resources, 'mcp-server-local'),
        harness: path.join(resources, 'mcp-server-harness'),
    });
};
