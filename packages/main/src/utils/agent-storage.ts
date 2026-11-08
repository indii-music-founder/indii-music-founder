import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function agentStoragePaths(packaged: boolean, userData: string, resources: string, cwd: string) {
    return {
        base: packaged ? userData : cwd,
        registry: path.join(packaged ? resources : cwd, 'agents', 'capability_registry.json'),
    };
}

function artifactName(value: unknown): string {
    if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('\\') ||
        path.basename(value) !== value || value === '.' || value === '..' ||
        !(value.endsWith('.md') || value.endsWith('.json')) || value === '.md' || value === '.json') {
        throw new Error('Invalid artifact filename');
    }
    return value;
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

/** App-owned artifact directory, independent of packaged install permissions. */
export class AgentArtifactStore {
    constructor(private readonly base: string) {}

    private async root(create = false): Promise<string> {
        if (create) await fs.mkdir(this.base, { recursive: true });
        const base = await fs.realpath(this.base);
        const root = path.join(base, 'artifacts');
        if (create) await fs.mkdir(root, { recursive: true });
        const info = await fs.lstat(root);
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid artifact directory');
        return root;
    }

    private async file(root: string, filename: string, allowMissing: boolean): Promise<string> {
        const target = path.join(root, filename);
        try {
            const info = await fs.lstat(target);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid artifact file');
        } catch (error) {
            if (!allowMissing || !missing(error)) throw error;
        }
        return target;
    }

    async write(filename: unknown, content: unknown): Promise<string> {
        const name = artifactName(filename);
        if (typeof content !== 'string') throw new Error('Invalid artifact content');
        const root = await this.root(true);
        const target = await this.file(root, name, true);
        const temporary = path.join(root, `.${randomUUID()}.tmp`);
        try {
            await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
            // Replace the directory entry rather than following a target symlink.
            await fs.rename(temporary, target);
        } finally {
            await fs.rm(temporary, { force: true });
        }
        return target;
    }

    async read(filename: unknown): Promise<string> {
        const name = artifactName(filename);
        const root = await this.root();
        return fs.readFile(await this.file(root, name, false), 'utf8');
    }

    async list(): Promise<{ filename: string }[]> {
        try {
            const root = await this.root();
            const entries = await fs.readdir(root, { withFileTypes: true });
            return entries.filter(entry => entry.isFile() && entry.name.endsWith('.md'))
                .map(entry => ({ filename: entry.name }));
        } catch (error) {
            if (missing(error)) return [];
            throw error;
        }
    }
}
