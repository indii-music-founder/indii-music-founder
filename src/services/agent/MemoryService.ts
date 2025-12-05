
import { firestoreService } from '../FirestoreService';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryItem {
    id: string;
    projectId: string;
    content: string;
    type: 'fact' | 'summary' | 'rule';
    timestamp: number;
    embedding?: number[];
}

class MemoryService {
    private getCollectionPath(projectId: string): string {
        return `projects/${projectId}/memories`;
    }

    async saveMemory(projectId: string, content: string, type: 'fact' | 'summary' | 'rule' = 'fact'): Promise<void> {
        // Check for duplicates (simple content match for now)
        // Ideally we'd use a vector similarity check here
        const existing = await this.retrieveRelevantMemories(projectId, content, 100);
        if (existing.includes(content)) {
            return;
        }

        const item: Omit<MemoryItem, 'id'> = {
            projectId,
            content,
            type,
            timestamp: Date.now()
        };

        await firestoreService.add(this.getCollectionPath(projectId), item);
    }

    async retrieveRelevantMemories(projectId: string, query: string, limit = 5): Promise<string[]> {
        // Fetch all memories for the project
        // Note: In a real production app with many memories, we would need vector search here.
        // For now, fetching all (likely < 100) and filtering in memory is acceptable.
        try {
            const memories = await firestoreService.list<MemoryItem>(this.getCollectionPath(projectId));

            // Simple keyword scoring since we don't have a vector DB yet
            const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);

            const scored = memories.map(m => {
                let score = 0;
                const content = m.content.toLowerCase();
                keywords.forEach(k => {
                    if (content.includes(k)) score++;
                });
                // Boost 'rule' type memories as they are critical instructions
                if (m.type === 'rule') score += 0.5;

                return { content: m.content, score, timestamp: m.timestamp };
            });

            scored.sort((a, b) => b.score - a.score);

            // Filter out zero scores unless we have very few results
            const relevant = scored.filter(s => s.score > 0);

            // If no relevant memories found, return recent rules as fallback context
            if (relevant.length === 0) {
                return scored
                    .filter(s => s.content.includes('rule') || s.content.includes('RULE')) // Fallback check
                    .slice(0, 3)
                    .map(s => s.content);
            }

            return relevant.slice(0, limit).map(s => s.content);
        } catch (error) {
            console.error('Error retrieving memories', error);
            return [];
        }
    }

    async clearProjectMemory(projectId: string): Promise<void> {
        const path = this.getCollectionPath(projectId);
        const memories = await firestoreService.list<MemoryItem>(path);

        // Parallel deletion
        await Promise.all(memories.map(m => firestoreService.delete(path, m.id)));
    }
}

export const memoryService = new MemoryService();
