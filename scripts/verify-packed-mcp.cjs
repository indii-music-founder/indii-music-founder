const path = require('node:path');
const fs = require('node:fs/promises');

// Inspect the actual app's collected resources, before signing/publishing.
// No renderer/authentication state is injected by this package verification.
exports.default = async context => {
    const resources = context.packager.getResourcesDir(context.appOutDir);
    const registry = JSON.parse(await fs.readFile(path.join(resources, 'agents/capability_registry.json'), 'utf8'));
    const { assertPortableAgentRegistry } = require('./portable-agent-registry.cjs');
    assertPortableAgentRegistry(registry);
    const { verifyBundledMcp } = await import('./verify-bundled-mcp.mjs');
    await verifyBundledMcp({
        local: path.join(resources, 'mcp-server-local'),
        harness: path.join(resources, 'mcp-server-harness'),
    });
};
