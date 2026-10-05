const path = require('node:path');

// Inspect the actual app's collected resources, before signing/publishing.
// No renderer/authentication state is injected by this package verification.
exports.default = async context => {
    const resources = context.packager.getResourcesDir(context.appOutDir);
    const { verifyBundledMcp } = await import('./verify-bundled-mcp.mjs');
    await verifyBundledMcp({
        local: path.join(resources, 'mcp-server-local'),
        harness: path.join(resources, 'mcp-server-harness'),
    });
};
