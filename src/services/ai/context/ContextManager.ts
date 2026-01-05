import { Content } from '@/shared/types/ai.dto';

export class ContextManager {
    /**
     * Rough estimation of tokens.
     * English: ~4 chars per token.
     * Code/Special chars: Can be 1-2 chars per token.
     * Safety margin: 1.2x
     */
    static estimateTokens(text: string): number {
        if (!text) return 0;
        return Math.ceil((text.length / 4) * 1.2);
    }

    static estimateContextTokens(contents: Content | Content[]): number {
        const arr = Array.isArray(contents) ? contents : [contents];
        let total = 0;
        for (const c of arr) {
            for (const part of c.parts) {
                if ('text' in part && typeof part.text === 'string') {
                    total += this.estimateTokens(part.text);
                }
            }
        }
        return total;
    }

    /**
     * Truncates conversation history to fit within maxTokens.
     * Strategy:
     * 1. ALWAYS keep system instructions (if identifiable, usually first or explicitly passed).
     * 2. ALWAYS keep the most recent N messages (context window tail).
     * 3. Drop from the middle/start of the conversation history.
     */
    static truncateContext(history: Content[], maxTokens: number, systemInstruction?: string): Content[] {
        const systemTokens = systemInstruction ? this.estimateTokens(systemInstruction) : 0;
        let currentTokens = systemTokens + this.estimateContextTokens(history);

        if (currentTokens <= maxTokens) return history;

        // If we are over budget:
        const truncated = [...history];

        // We want to keep at least the last 2 turns (User + Assistant) if possible
        const minItemsToKeep = 2;

        // While we are over budget and have more than min items
        while (currentTokens > maxTokens && truncated.length > minItemsToKeep) {
            // Remove the oldest message (index 0)
            // In a real chat, index 0 might be the first user message after system prompt.
            // If strict system prompt content object is used, be careful not to remove it if it's mixed in.
            // Assuming history is just the conversation flow here.

            const removed = truncated.shift();
            if (removed) {
                currentTokens -= this.estimateContextTokens(removed);
            }
        }

        if (currentTokens > maxTokens) {
            console.warn('[ContextManager] Context is still over limit after truncation. Request implies massive single message.');
        }

        return truncated;
    }
}
