import { UserMemory } from '../types';
import { FirebaseAIService as AIService } from '../../ai/FirebaseAIService';
import { logger } from '../../../utils/logger';

/**
 * MemorySummarizer handles the logic for condensing multiple memory entries
 * into a single, cohesive summary.
 */
export class MemorySummarizer {
    /**
     * Generates a topical summary of a set of memory entries.
     */
    public static async summarizeMemories(memories: UserMemory[]): Promise<string> {
        if (memories.length === 0) return '';
        if (memories.length === 1) return memories[0].content;

        try {
            const memoryText = memories.map(m => `- [${m.type}] ${m.content}`).join('\n');
            const prompt = `
Summarize the following user memories into a concise, high-density paragraph. 
Focus on recurring preferences, key facts, and established rules.
Do not lose specific details like artist names, technical requirements, or visual styles.

MEMORIES:
${memoryText}

SUMMARY:
`;

            const summary = await AIService.getInstance().generateText(
                prompt,
                0, // Thinking budget (0 for standard)
                { temperature: 0.2 } as any // Config object
            );

            return summary;
        } catch (error) {
            logger.error('[MemorySummarizer] Summarization failed:', error);
            // Fallback: simple join
            return memories.slice(0, 5).map(m => m.content).join('. ');
        }
    }
}
