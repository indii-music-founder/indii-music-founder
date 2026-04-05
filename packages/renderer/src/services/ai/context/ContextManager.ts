import { Content } from '@/shared/types/ai.dto';
import { logger } from '@/utils/logger';

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
                if ('text' in part && part.text) {
                    total += this.estimateTokens(part.text);
                } else if ('inlineData' in part) {
                    // Standard buffer for multimodal data (Images are usually ~258 tokens, but we use a safety margin)
                    total += 500;
                } else if ('functionCall' in part || 'functionResponse' in part) {
                    total += 100; // Buffer for tool usage
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

        // Preservation Rules
        const MIN_RECENT_MESSAGES = 2; // Keep at least last user/model exchange
        const KEEP_FIRST_MESSAGE = true; // Try to keep the very first message

        // Safety valve: Limit total drops to prevent infinite loops (though length always decreases)
        const MAX_DROPS = history.length;
        let drops = 0;

        // Optimization: For VERY large histories (> 1000 turns), we should consider batch dropping
        // but for now, let's just fix the iterations and ensure we don't hit the 1000 limit.
        const truncated = [...history];

        while (currentTokens > maxTokens && truncated.length > MIN_RECENT_MESSAGES && drops < MAX_DROPS) {
            drops++;

            let removeIndex = 0;
            if (KEEP_FIRST_MESSAGE && truncated.length > (MIN_RECENT_MESSAGES + 1)) {
                // Remove the second message (index 1) to preserve the anchor (index 0)
                removeIndex = 1;
            } else {
                // Drop the oldest message
                removeIndex = 0;
            }

            const removed = truncated[removeIndex];
            if (removed) {
                currentTokens -= this.estimateContextTokens(removed);
                truncated.splice(removeIndex, 1);
            }

            // [STRESS SAFETY] If we've dropped 5000 messages and STILL over limit, 
            // maybe we have a massive single message. We should break to avoid hang.
            if (drops >= 10000) {
                logger.error('[ContextManager] EXTREME TRUNCATION: Dropped 10,000 messages and still over limit. Breaking loop.');
                break;
            }
        }

        if (currentTokens > maxTokens) {
            logger.warn(`[ContextManager] Context over limit (${currentTokens}/${maxTokens}) after ${drops} drops. Recent messages are too large.`);
        }

        return truncated;
    }
}
