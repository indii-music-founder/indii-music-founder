
import { AgentMessage } from './types';
import { db, DB_STORES } from './db';
import * as dbMod from './db'; // For getProjectAgentMemory which is exported there

export type MemoryItem = {
    id: string;
    projectId: string;
    content: string;
    type: 'fact' | 'summary' | 'rule';
    timestamp: number;
    embedding?: number[]; // Placeholder for future vector support
};

// In-memory cache for the active session
let memoryCache: MemoryItem[] = [];

/**
 * Saves a long-term memory item to IndexedDB
 */
export async function saveMemory(projectId: string, content: string, type: 'fact' | 'summary' | 'rule' = 'fact') {
    const item: MemoryItem = {
        id: crypto.randomUUID(),
        projectId,
        content,
        type,
        timestamp: Date.now()
    };

    // Check for duplicates to avoid spamming
    const exists = memoryCache.find(m => m.content === content && m.projectId === projectId);
    if(exists) return;

    memoryCache.push(item);

    // We reuse the AGENT_MEMORY store for now, or we could create a new one.
    // The Spec said "Long Term Vector Memory".
    // Since we don't have a vector DB, we'll store it as a structured "System Message" equivalent
    // or better, a dedicated object store if we had one.
    // Existing DB has `AGENT_MEMORY` which stores `AgentMessage`.
    // We will piggyback on that OR just keep it simple:
    // We will verify if we can add a new store easily. `db.ts` initDB checks stores.

    // For now, let's treat "Memory" as a special kind of AgentMessage so it persists in the existing store
    // without needing a schema migration that might wipe data if not careful.
    // Or we can just use the 'agent_memory' store but with a special role 'memory'.

    const msg: AgentMessage = {
        id: item.id,
        role: 'system', // Use system role so it's treated as context
        text: `[MEMORY:${type.toUpperCase()}] ${content}`,
        projectId: projectId,
        timestamp: item.timestamp
    };

    await dbMod.saveAgentMessage(msg);
}

/**
 * Retrieves relevant memories for a context.
 * Currently uses simple keyword matching since we lack a Vector DB.
 */
export async function retrieveRelevantMemories(projectId: string, query: string, limit = 5): Promise<string[]> {
    // 1. Get all memories for project (filtered by our special prefix)
    const allMsgs = await dbMod.getProjectAgentMemory(projectId);
    const memories = allMsgs.filter(m => m.text.startsWith('[MEMORY:'));

    // 2. Simple Keyword Scoring
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);

    const scored = memories.map(m => {
        let score = 0;
        const content = m.text.toLowerCase();
        keywords.forEach(k => {
            if (content.includes(k)) score++;
        });
        // Boost recent memories slightly? No, facts are timeless.
        return { content: m.text, score, timestamp: m.timestamp };
    });

    // 3. Sort and Slice
    scored.sort((a, b) => b.score - a.score);

    // If no keywords match, maybe return the most recent "Rules"?
    if (scored.length > 0 && scored[0].score === 0) {
        // Fallback: Return recent rules
        return scored
            .filter(s => s.content.includes('MEMORY:RULE'))
            .slice(0, 3)
            .map(s => s.content);
    }

    return scored.slice(0, limit).filter(s => s.score > 0).map(s => s.content);
}

/**
 * Validates tool arguments against a schema.
 * Since we can't import Zod easily without build steps, we do a runtime check.
 */
export function validateSchema(args: any, schema: any): { valid: boolean, error?: string } {
    for (const key in schema) {
        const expectedType = schema[key];
        const val = args[key];

        if (val === undefined) return { valid: false, error: `Missing argument: ${key}` };

        if (expectedType === 'string' && typeof val !== 'string') return { valid: false, error: `${key} must be a string` };
        if (expectedType === 'number' && typeof val !== 'number') return { valid: false, error: `${key} must be a number` };
        if (expectedType === 'boolean' && typeof val !== 'boolean') return { valid: false, error: `${key} must be a boolean` };

        // Simple array check
        if (Array.isArray(expectedType) && !Array.isArray(val)) return { valid: false, error: `${key} must be an array` };
    }
    return { valid: true };
}
