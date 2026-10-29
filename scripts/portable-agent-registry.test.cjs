const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { portableAgentRegistry, assertPortableAgentRegistry } = require('./portable-agent-registry.cjs');

test('actual source catalog retains every capability without build-machine path fields', () => {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../agents/capability_registry.json'), 'utf8'));
    const portable = portableAgentRegistry(source);
    assert.equal(portable.root, 'agents');
    assert.equal(Object.keys(portable.agents).length, Object.keys(source.agents).length);
    for (const [id, agent] of Object.entries(source.agents)) {
        assert.deepEqual(portable.agents[id], { ...agent, path: `agents/${id}` });
    }
    assert.ok(!JSON.stringify(portable).includes(source.root));
    assertPortableAgentRegistry(portable);
    assert.throws(() => assertPortableAgentRegistry(source), /nonportable/);
});

test('rejects invalid catalogs and path-bearing agent IDs before packaging', () => {
    for (const source of [null, {}, { agents: [] }, { agents: {} }, { agents: { '../escape': {} } }]) {
        assert.throws(() => portableAgentRegistry(source));
    }
});
