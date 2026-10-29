const fs = require('node:fs/promises');
const path = require('node:path');

function portableAgentRegistry(source) {
    if (!source || typeof source !== 'object' || !source.agents ||
        typeof source.agents !== 'object' || Array.isArray(source.agents) ||
        Object.keys(source.agents).length === 0) throw new Error('Invalid agent capability catalog');
    const agents = Object.fromEntries(Object.entries(source.agents).map(([id, data]) => {
        if (!/^[A-Za-z0-9_-]+$/.test(id) || !data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Invalid agent capability entry');
        }
        return [id, { ...data, path: `agents/${id}` }];
    }));
    return { ...source, root: 'agents', agents };
}

function assertPortableAgentRegistry(registry) {
    const expected = portableAgentRegistry(registry);
    if (JSON.stringify(expected) !== JSON.stringify(registry)) throw new Error('Packaged agent catalog contains nonportable paths');
}

async function buildPortableAgentRegistry(root) {
    const source = JSON.parse(await fs.readFile(path.join(root, 'agents/capability_registry.json'), 'utf8'));
    const registry = portableAgentRegistry(source);
    const output = path.join(root, 'dist/agent-catalog');
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'capability_registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
}

module.exports = { portableAgentRegistry, assertPortableAgentRegistry, buildPortableAgentRegistry };
