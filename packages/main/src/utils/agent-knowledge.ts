import { AgentArtifactStore } from './agent-storage';

function identifier(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(value)) throw new Error('Invalid agent identifier');
    return value;
}

/** Writable OS-user overlay. It never edits bundled prompts or invokes Git. */
export class AgentKnowledgeStore {
    private readonly files: AgentArtifactStore;
    private readonly pending = new Map<string, Promise<unknown>>();
    constructor(base: string) { this.files = new AgentArtifactStore(base); }

    async read(agentId: unknown): Promise<string[]> {
        const name = `${identifier(agentId)}.json`;
        try {
            const value: unknown = JSON.parse(await this.files.read(name));
            if (!Array.isArray(value) || value.length > 100 || value.some(line => typeof line !== 'string' || line.length > 4000)) {
                throw new Error('Invalid stored agent knowledge');
            }
            return value;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw error;
        }
    }

    async update(agentId: unknown, action: unknown, content: unknown): Promise<{ path: string; count: number }> {
        const id = identifier(agentId);
        if (action !== 'add' && action !== 'remove') throw new Error('Invalid knowledge action');
        if (typeof content !== 'string' || !content.trim() || content.length > 4000) throw new Error('Invalid knowledge content');
        const text = content.trim();
        const previous = this.pending.get(id);
        const operation = (async () => {
            await previous?.catch(() => undefined);
            const entries = await this.read(id);
            const next = action === 'add' ? [...new Set([...entries, text])] : entries.filter(entry => entry !== text);
            if (next.length > 100) throw new Error('Agent knowledge limit reached');
            const output = await this.files.write(`${id}.json`, JSON.stringify(next));
            return { path: output, count: next.length };
        })();
        this.pending.set(id, operation);
        try { return await operation; }
        finally { if (this.pending.get(id) === operation) this.pending.delete(id); }
    }
}
