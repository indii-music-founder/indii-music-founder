
import { FirestoreService } from '../FirestoreService';
import { AI } from '../ai/AIService';

export interface MemoryItem {
    id: string;
    projectId: string;
    content: string;
    type: 'fact' | 'summary' | 'rule';
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
                content: { parts: [{ text }] }
            });
            // Extract embedding from response
            const embedding = (result as any)?.embedding?.values;
            return embedding || [];
        } catch (error) {
            console.warn('[MemoryService] Failed to get embedding, falling back to keyword search:', error);
            return [];
        }
    }

    async saveMemory(projectId: string, content: string, type: 'fact' | 'summary' | 'rule' = 'fact'): Promise<void> {
        const service = this.getService(projectId);

        // Check for duplicates using vector similarity
        const existingMemories = await service.list();

        // Simple content match for exact duplicates
        if (existingMemories.some(m => m.content === content)) {
            return;
        }

        // Generate embedding for the new memory
        const embedding = await this.getEmbedding(content);

        const item: Omit<MemoryItem, 'id'> = {
            projectId,
            content,
            type,
            timestamp: Date.now(),
            embedding: embedding.length > 0 ? embedding : undefined
        };

        await service.add(item);
    }

    async retrieveRelevantMemories(projectId: string, query: string, limit = 5): Promise<string[]> {
        try {
            const service = this.getService(projectId);
            const memories = await service.list();

            if (memories.length === 0) return [];

            // Try vector search if embeddings are available
            const queryEmbedding = await this.getEmbedding(query);
            const hasVectorSupport = queryEmbedding.length > 0 && memories.some(m => m.embedding && m.embedding.length > 0);

            let scored: { content: string; score: number; timestamp: number; type: string }[];

            if (hasVectorSupport) {
                // Vector-based semantic search
                scored = memories.map(m => {
                    let score = 0;
                    if (m.embedding && m.embedding.length > 0) {
                        score = cosineSimilarity(queryEmbedding, m.embedding);
                    }
                    // Boost 'rule' type memories as they are critical instructions
                    if (m.type === 'rule') score += 0.1;
                    return { content: m.content, score, timestamp: m.timestamp, type: m.type };
                });
            } else {
                // Fallback to keyword scoring
                const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
                scored = memories.map(m => {
                    let score = 0;
                    const content = m.content.toLowerCase();
                    keywords.forEach(k => {
                        if (content.includes(k)) score++;
                    });
                    if (m.type === 'rule') score += 0.5;
                    return { content: m.content, score, timestamp: m.timestamp, type: m.type };
                });
            }

            scored.sort((a, b) => b.score - a.score);

            // Filter by threshold (0.5 for vector, 0 for keywords)
            const threshold = hasVectorSupport ? 0.5 : 0;
            const relevant = scored.filter(s => s.score > threshold);

            // If no relevant memories found, return recent rules as fallback context
            if (relevant.length === 0) {
                return scored
                    .filter(s => s.type === 'rule')
                    .slice(0, 3)
                    .map(s => s.content);
            }

            return relevant.slice(0, limit).map(s => s.content);
        } catch (error) {
            console.error('[MemoryService] Error retrieving memories:', error);
            return [];
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
