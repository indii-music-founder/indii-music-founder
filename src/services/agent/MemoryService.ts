
import { FirestoreService } from '../FirestoreService';
import { AI } from '../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export interface MemoryItem {
    id: string;
    projectId: string;
    content: string;
    type: 'fact' | 'summary' | 'rule' | 'preference';
    importance: number; // 0 to 1
    accessCount: number;
    lastAccessed: number;
    source: 'user' | 'agent' | 'system';
    tags?: string[];
    timestamp: number;
    embedding?: number[];
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class MemoryService {
    private embeddingModel = 'text-embedding-004';

    private getCollectionPath(projectId: string): string {
        return `projects/${projectId}/memories`;
    }

    private getService(projectId: string): FirestoreService<MemoryItem> {
        return new FirestoreService<MemoryItem>(this.getCollectionPath(projectId));
    }

    private async getEmbedding(text: string): Promise<number[]> {
        try {
            const result = await AI.embedContent({
                model: this.embeddingModel,
                content: { role: 'user', parts: [{ text }] }
            });
            // AIService.embedContent returns { values: number[] } directly
            return result?.values || [];
        } catch (error) {
            console.warn('[MemoryService] Failed to get embedding, falling back to keyword search:', error);
            return [];
        }
    }

    async saveMemory(
        projectId: string,
        content: string,
        type: MemoryItem['type'] = 'fact',
        importance = 0.5,
        source: MemoryItem['source'] = 'user'
    ): Promise<void> {
        const service = this.getService(projectId);

        // Check for duplicates using vector similarity (simple dedup)
        const existingMemories = await service.list();
        if (existingMemories.some(m => m.content === content)) {
            return;
        }

        // Generate embedding for the new memory
        const embedding = await this.getEmbedding(content);

        const item: Omit<MemoryItem, 'id'> = {
            projectId,
            content,
            type,
            importance,
            source,
            accessCount: 0,
            lastAccessed: Date.now(),
            tags: [],
            timestamp: Date.now(),
            embedding: embedding.length > 0 ? embedding : undefined
        };

        await service.add(item);
    }

    async retrieveRelevantMemories(
        projectId: string,
        queryOrOptions: string | {
            query: string;
            filters?: {
                tags?: string[];
                types?: MemoryItem['type'][];
                dateRange?: [number, number]; // timestamps
            };
            limit?: number;
        },
        limitIdx = 5
    ): Promise<string[]> {
        try {
            const service = this.getService(projectId);
            const memories = await service.list(); // In production, push filters to DB query if possible

            if (memories.length === 0) return [];

            const options = typeof queryOrOptions === 'string'
                ? { query: queryOrOptions, limit: limitIdx }
                : { limit: limitIdx, ...queryOrOptions };

            const { query, filters, limit = 5 } = options;

            // 1. Apply Metadata Filters
            let candidates = memories;
            if (filters) {
                candidates = candidates.filter(m => {
                    if (filters.types && !filters.types.includes(m.type)) return false;
                    if (filters.tags && filters.tags.length > 0) {
                        const hasTag = m.tags?.some(t => filters.tags!.includes(t));
                        if (!hasTag) return false;
                    }
                    if (filters.dateRange) {
                        if (m.timestamp < filters.dateRange[0] || m.timestamp > filters.dateRange[1]) return false;
                    }
                    return true;
                });
            }

            if (candidates.length === 0) return [];

            // 2. Try vector search if embeddings are available
            const queryEmbedding = await this.getEmbedding(query);
            const hasVectorSupport = queryEmbedding.length > 0 && candidates.some(m => m.embedding && m.embedding.length > 0);

            let scored: { item: MemoryItem; score: number }[];

            if (hasVectorSupport) {
                // Semantic Search + Importance + Recency
                scored = candidates.map(m => {
                    let vectorScore = 0;
                    if (m.embedding && m.embedding.length > 0) {
                        vectorScore = cosineSimilarity(queryEmbedding, m.embedding);
                    }

                    // Recency Score (Decay over 30 days)
                    const daysOld = (Date.now() - m.timestamp) / (1000 * 60 * 60 * 24);
                    const recencyScore = 1 / (1 + 0.1 * daysOld); // Hyperbolic decay

                    // Final Score Formula
                    // content relevance * 0.6 + importance * 0.2 + recency * 0.2
                    // Boost 'rule' types always
                    let totalScore = (vectorScore * 0.6) + (m.importance * 0.2) + (recencyScore * 0.2);

                    // Extra boost if filter matched specifically? No, filter is hard constraint.
                    if (m.type === 'rule') totalScore += 0.15;

                    return { item: m, score: totalScore };
                });
            } else {
                // Keyword Search Fallback
                const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
                scored = candidates.map(m => {
                    let matchCount = 0;
                    const content = m.content.toLowerCase();
                    keywords.forEach(k => {
                        if (content.includes(k)) matchCount++;
                    });

                    let totalScore = matchCount > 0 ? (0.5 + Math.min(matchCount * 0.1, 0.4)) : 0;
                    if (m.type === 'rule') totalScore += 0.2;
                    return { item: m, score: totalScore };
                });
            }

            // Sort by score
            scored.sort((a, b) => b.score - a.score);

            // Filter threshold
            const threshold = hasVectorSupport ? 0.6 : 0.1;
            const relevantItems = scored
                .filter(s => s.score > threshold)
                .slice(0, limit)
                .map(s => s.item);

            // Async: Update access stats for retrieved items (fire and forget)
            this.updateAccessStats(projectId, relevantItems);

            // Fallback if nothing relevant found (Relax filters? No, strict filters should be respected)
            // But if generic query failed, we fallback to recent rules
            if (relevantItems.length === 0 && !filters) {
                return memories
                    .filter(m => m.type === 'rule' || m.importance > 0.8)
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 3)
                    .map(m => m.content);
            }

            return relevantItems.map(m => m.content);

        } catch (error) {
            console.error('[MemoryService] Error retrieving memories:', error);
            return [];
        }
    }

    private async updateAccessStats(projectId: string, items: MemoryItem[]) {
        const service = this.getService(projectId);
        const updates = items.map(item =>
            service.update(item.id, {
                accessCount: (item.accessCount || 0) + 1,
                lastAccessed: Date.now()
            })
        );
        // We don't await this in the main path to keep retrieval fast
        Promise.all(updates).catch(e => console.error('[MemoryService] Failed to update stats:', e));
    }

    async consolidateMemories(projectId: string): Promise<void> {
        const service = this.getService(projectId);
        const memories = await service.list();

        // 1. Filter candidates (e.g., accessed recently but older than 24h, not rules)
        const candidates = memories.filter(m =>
            m.type === 'fact' &&
            (Date.now() - m.timestamp > 86400000)
        );

        if (candidates.length < 5) return; // Not enough to consolidate

        // 2. Simple clustering or just lump together for now (naive approach)
        // Group everything into one massive summary request for now

        const textToSummarize = candidates.map(c => `- ${c.content}`).join('\n');

        try {
            const prompt = `
            You are a Memory Consolidation Agent.
            
            TASK:
            Review the following memory fragments and consolidate them into concise, high-value summaries.
            Discard redundant or trivial information.
            Check against these existing summaries/rules to avoid duplication: 
            ${memories.filter(m => m.type !== 'fact').map(m => m.content).join('\n')}

            MEMORY FRAGMENTS TO PROCESS:
            ${textToSummarize}
            
            OUTPUT RULES:
            - Return a strict JSON object.
            - "consolidated": Array of strings (the new summary text).
            - "idsToDelete": Array of strings (the IDs of fragments you successfully incorporated and can be removed).
            
            JSON FORMAT:
            {
              "consolidated": ["summary 1", "summary 2"],
              "idsToDelete": ["id_1", "id_2"]
            }
            `;

            const result = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST, // Use fast model for background tasks
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const responseText = result.text() || '{}';
            const parsed = JSON.parse(responseText) as { consolidated: string[], idsToDelete: string[] };

            // 1. Delete redundant memories
            if (parsed.idsToDelete && parsed.idsToDelete.length > 0) {
                const deletePromises = parsed.idsToDelete.map(id => {
                    // Verify ID exists in candidates to prevent accidental deletion of wrong items
                    if (candidates.some(c => c.id === id)) {
                        return service.delete(id);
                    }
                    return Promise.resolve();
                });
                await Promise.all(deletePromises);
            }

            // 2. Add new consolidated memories
            if (parsed.consolidated && parsed.consolidated.length > 0) {
                const addPromises = parsed.consolidated.map(content =>
                    this.saveMemory(projectId, content, 'summary', 0.8, 'system')
                );
                await Promise.all(addPromises);
            }

            console.info(`[MemoryService] Consolidated ${parsed.idsToDelete?.length || 0} memories into ${parsed.consolidated?.length || 0} summaries.`);

        } catch (e) {
            console.error('[MemoryService] Consolidation failed:', e);
        }
    }

    async clearProjectMemory(projectId: string): Promise<void> {
        const service = this.getService(projectId);
        const memories = await service.list();
        await Promise.all(memories.map(m => service.delete(m.id)));
    }

    // Utility to regenerate embeddings for existing memories (migration helper)
    async regenerateEmbeddings(projectId: string): Promise<number> {
        const service = this.getService(projectId);
        const memories = await service.list();

        let updated = 0;
        for (const memory of memories) {
            if (!memory.embedding || memory.embedding.length === 0) {
                const embedding = await this.getEmbedding(memory.content);
                if (embedding.length > 0) {
                    await service.update(memory.id, { embedding });
                    updated++;
                }
            }
        }
        return updated;
    }
}

export const memoryService = new MemoryService();
