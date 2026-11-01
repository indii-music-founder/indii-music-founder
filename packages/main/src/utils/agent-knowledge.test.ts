import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentKnowledgeStore } from './agent-knowledge';

describe('native knowledge overlay', () => {
    it('persists, deduplicates and serializes updates without editing bundled files', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'indii-knowledge-'));
        try {
            const store = new AgentKnowledgeStore(root);
            expect(await store.read('conductor')).toEqual([]);
            await Promise.all([store.update('conductor', 'add', 'First'), store.update('conductor', 'add', 'Second')]);
            await store.update('conductor', 'add', 'First');
            expect(await new AgentKnowledgeStore(root).read('conductor')).toEqual(['First', 'Second']);
            await store.update('conductor', 'remove', 'First');
            expect(await store.read('conductor')).toEqual(['Second']);
            await expect(store.update('../escape', 'add', 'No')).rejects.toThrow('identifier');
            await expect(store.update('conductor', 'add', '')).rejects.toThrow('content');
            await fs.symlink(path.join(root, 'artifacts', 'conductor.json'), path.join(root, 'artifacts', 'other.json'));
            await expect(store.read('other')).rejects.toThrow('artifact');
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
});
