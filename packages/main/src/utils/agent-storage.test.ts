import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AgentArtifactStore, agentStoragePaths } from './agent-storage';

describe('app-owned artifact filesystem and packaged resource paths', () => {
    let root: string;
    let store: AgentArtifactStore;
    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'indii-artifact-store-'));
        store = new AgentArtifactStore(path.join(root, 'userData'));
    });
    afterEach(async () => fs.rm(root, { recursive: true, force: true }));

    it('selects writable userData and bundled resources in packaged mode', () => {
        expect(agentStoragePaths(true, '/user/data', '/app/resources', '/install')).toEqual({
            base: '/user/data', registry: path.join('/app/resources', 'agents/capability_registry.json'),
        });
        expect(agentStoragePaths(false, '/user/data', '/app/resources', root).base).toBe(root);
    });
    it('creates, overwrites, lists and reloads a native artifact without an install-directory write', async () => {
        const target = await store.write('report.md', 'first');
        expect(target).toBe(path.join(await fs.realpath(path.join(root, 'userData')), 'artifacts/report.md'));
        await store.write('report.md', 'updated');
        expect(await new AgentArtifactStore(path.join(root, 'userData')).read('report.md')).toBe('updated');
        expect(await store.list()).toEqual([{ filename: 'report.md' }]);
        expect(await fs.readdir(path.dirname(target))).toEqual(['report.md']);
    });
    it('returns an empty list for an absent store', async () => {
        expect(await store.list()).toEqual([]);
    });
    it('rejects traversal and non-filenames before creating directories', async () => {
        for (const filename of ['', '..', '.', '.md', '../private.md', '/private.md', 'sub/file.md', 'sub\\file.md', 'bad\0.md', 'script.sh', 'payload.exe', 'notes.txt']) {
            await expect(store.write(filename, 'data')).rejects.toThrow('Invalid artifact filename');
            await expect(store.read(filename)).rejects.toThrow('Invalid artifact filename');
        }
        await expect(fs.stat(path.join(root, 'userData'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    it('rejects symlink targets without reading or overwriting external content', async () => {
        await store.write('regular.md', 'safe');
        const external = path.join(root, 'external.md');
        await fs.writeFile(external, 'private');
        await fs.symlink(external, path.join(root, 'userData/artifacts/link.md'));
        await expect(store.read('link.md')).rejects.toThrow('Invalid artifact file');
        await expect(store.write('link.md', 'overwrite')).rejects.toThrow('Invalid artifact file');
        expect(await fs.readFile(external, 'utf8')).toBe('private');
        expect(await store.list()).toEqual([{ filename: 'regular.md' }]);
    });
    it('rejects a symlinked artifact directory', async () => {
        await fs.mkdir(path.join(root, 'userData'));
        await fs.mkdir(path.join(root, 'outside'));
        await fs.symlink(path.join(root, 'outside'), path.join(root, 'userData/artifacts'));
        await expect(store.write('report.md', 'data')).rejects.toThrow('Invalid artifact directory');
        await expect(store.list()).rejects.toThrow('Invalid artifact directory');
        expect(await fs.readdir(path.join(root, 'outside'))).toEqual([]);
    });
});
