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
     * Strategy: Smart Sliding Window
     * 1. Reserve tokens for System Instructions (highest priority).
     * 2. Reserve tokens for the last 2 turns (User + Model) to ensure continuity.
     * 3. If still over budget, drop messages from the *middle* of the conversation, 
     *    preserving the *first* message (often sets the stage) if possible.
     */
    static truncateContext(history: Content[], maxTokens: number, systemInstruction?: string): Content[] {
        const systemTokens = systemInstruction ? this.estimateTokens(systemInstruction) : 0;
        let currentTokens = systemTokens + this.estimateContextTokens(history);

        if (currentTokens <= maxTokens) return history;

        // If we are over budget:
        const truncated = [...history];

        // Preservation Rules
        const MIN_RECENT_MESSAGES = 2; // Keep at least last user/model exchange
        const KEEP_FIRST_MESSAGE = true; // Try to keep the very first message (context anchor)

        // While over budget and we have more than the absolute minimum partial context
        // We stop if we are down to just the recent messages
        while (currentTokens > maxTokens && truncated.length > MIN_RECENT_MESSAGES) {

            // Determine which index to remove
            // If we want to keep the first message, and we have enough messages to drop from middle...
            // Indices: 0 (First), 1 (Second)... N-2, N-1 (Recent)
            // If length > MIN_RECENT + 1 (and KEEP_FIRST), we can drop index 1.
            // Otherwise we fallback to dropping index 0.

            let removeIndex = 0;

            if (KEEP_FIRST_MESSAGE && truncated.length > (MIN_RECENT_MESSAGES + 1)) {
                // Remove from the "middle" (second oldest message)
                removeIndex = 1;
            } else {
                // Drop the oldest message
                removeIndex = 0;
            }

            const [removed] = truncated.splice(removeIndex, 1);
            if (removed) {
                currentTokens -= this.estimateContextTokens(removed);
            }
        }

        if (currentTokens > maxTokens) {
            console.warn(`[ContextManager] Context over limit (${currentTokens}/${maxTokens}) even after aggressive truncation. Recent messages are too large.`);
        }

        return truncated;
    }
}
