
import { describe, it, expect } from 'vitest';
import { ContextManager } from '@/services/ai/context/ContextManager';
import { Content } from '@/shared/types/ai.dto';

describe('📚 Keeper: Smart Context Window', () => {

    // Helper to create content with specific text
    const createMsg = (role: 'user' | 'model', text: string): Content => ({
        role,
        parts: [{ text }]
    });

    // Helper to calculate tokens using the actual implementation
    const getTokens = (contents: Content[]) => ContextManager.estimateContextTokens(contents);

    it('should preserve system instructions (priority #1)', () => {
        const history = [
            createMsg('user', 'Hello'),
            createMsg('model', 'Hi there')
        ];
        const systemInstruction = "You are a helpful assistant.";

        const systemTokens = ContextManager.estimateTokens(systemInstruction);
        const historyTokens = getTokens(history);
        const totalTokens = systemTokens + historyTokens;

        // Case 1: Limit fits everything
        const result = ContextManager.truncateContext(history, totalTokens, systemInstruction);
        expect(result).toHaveLength(2);

        // Case 2: Limit is very tight (system + <2 messages).
        // The truncator respects a hard floor of MIN_RECENT_MESSAGES (2).
        // So even if we are over budget, it should return the last 2 messages.
        const tightLimit = systemTokens + 1;

        const resultTight = ContextManager.truncateContext(history, tightLimit, systemInstruction);
        expect(resultTight).toHaveLength(2);
        // It should warn in console, but we just check length here.
    });

    it('should preserve the first message (anchor) and last 2 messages (recency) while dropping the middle', () => {
        // Create 10 messages
        // Make them large enough so token count is significant
        const messages = Array.from({ length: 10 }, (_, i) =>
            createMsg(i % 2 === 0 ? 'user' : 'model', `Message ${i} - ${'x'.repeat(20)}`)
        );
        // Indices: 0, 1, 2, ..., 9.
        // Target: Keep 0 (Anchor), 8, 9 (Recent). Drop 1..7.

        const anchor = messages[0];
        const recent1 = messages[8];
        const recent2 = messages[9];

        const keepTokens = getTokens([anchor, recent1, recent2]);
        // Set limit exactly to what we want to keep + a tiny buffer that is NOT enough for another message
        const limit = keepTokens + 2;

        const result = ContextManager.truncateContext(messages, limit);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual(anchor);
        expect(result[1]).toEqual(recent1);
        expect(result[2]).toEqual(recent2);
    });

    it('should drop the anchor if budget is extremely tight (survival mode)', () => {
         // If we only have budget for 2 messages (Recent), we should drop the anchor.
         const messages = Array.from({ length: 5 }, (_, i) =>
            createMsg(i % 2 === 0 ? 'user' : 'model', `Message ${i} - ${'y'.repeat(10)}`)
        );
        // 0 (Anchor), 1, 2, 3 (Recent), 4 (Recent)

        const recentTokens = getTokens([messages[3], messages[4]]);
        const limit = recentTokens + 2;

        // Logic check:
        // Start len=5. > 3. Drop index 1. -> [0, 2, 3, 4]
        // len=4. > 3. Drop index 1 (was 2). -> [0, 3, 4]
        // len=3. > 3? False.
        // Wait, loop condition: truncated.length > MIN_RECENT_MESSAGES (2).
        // So it continues when len=3.
        // Inside: len (3) > MIN_RECENT + 1 (3)? False.
        // Else: removeIndex = 0.
        // Removes anchor. -> [3, 4]
        // len=2. > 2? False. Stop.

        const result = ContextManager.truncateContext(messages, limit);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(messages[3]);
        expect(result[1]).toEqual(messages[4]);
    });
});
