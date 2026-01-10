import { describe, it, expect } from 'vitest';
import { ContextManager } from './ContextManager';
import { Content } from '@/shared/types/ai.dto';

// --- Keeper's Toolkit ---

/**
 * Generates a text string that roughly compiles to the requested number of tokens.
 * Based on ContextManager logic: tokens = ceil((len / 4) * 1.2)
 */
const generateTokenLoad = (targetTokens: number): string => {
  if (targetTokens <= 0) return '';
  // len = (tokens / 1.2) * 4
  // We add a bit of padding loop to hit exact target if needed,
  // but for now simple math is close enough for threshold testing.
  const targetLen = Math.ceil((targetTokens / 1.2) * 4);
  return 'a'.repeat(targetLen);
};

const createMsg = (role: 'user' | 'model' | 'system', text: string): Content => ({
    role,
    parts: [{ text }]
});

describe('📚 Keeper: Context Window Integrity', () => {

    it('The Middle Squeeze: Prioritizes Anchor (First) and Recent (Last 2) over Middle messages', () => {
        // Scenario: We have 6 messages. We have a token budget that only fits 3 messages.
        // We expect the system to keep:
        // 1. The Anchor (First message) - critical for "Who are you?" context
        // 2. The Recent (Last 2 messages) - critical for "What did I just say?" context
        // It should drop the messages in between (Index 1, 2, 3).

        // Setup: Each message is ~10 tokens.
        const msgTokenSize = 10;
        const payload = generateTokenLoad(msgTokenSize);

        // Confirm our generator works as expected (or close enough)
        const actualTokenSize = ContextManager.estimateTokens(payload);

        const history: Content[] = [
            createMsg('user', `ANCHOR_${payload}`),     // Index 0
            createMsg('model', `MIDDLE_1_${payload}`),  // Index 1
            createMsg('user', `MIDDLE_2_${payload}`),   // Index 2
            createMsg('model', `MIDDLE_3_${payload}`),  // Index 3
            createMsg('user', `RECENT_1_${payload}`),   // Index 4
            createMsg('model', `RECENT_2_${payload}`)   // Index 5
        ];

        // Total tokens approx: 6 * (actualTokenSize + extra chars for ID)
        const totalTokens = ContextManager.estimateContextTokens(history);

        // Budget: Enough for Anchor + Recent (3 messages) + a tiny bit of wiggle room,
        // but DEFINITELY not enough for 4 messages.
        // We need to calculate the exact size of the ones we want to keep to set a tight limit.
        const tokensToKeep = ContextManager.estimateContextTokens([history[0], history[4], history[5]]);
        const maxTokens = tokensToKeep + 2; // Allow tiny margin, but strictly less than adding another message

        // Act
        const result = ContextManager.truncateContext(history, maxTokens);

        // Assert
        expect(result).toHaveLength(3);

        // Verify Identity of survivors
        expect(result[0]).toEqual(history[0]); // Anchor
        expect(result[1]).toEqual(history[4]); // Recent 1
        expect(result[2]).toEqual(history[5]); // Recent 2

        // Verify victims
        expect(result).not.toContain(history[1]);
        expect(result).not.toContain(history[2]);
        expect(result).not.toContain(history[3]);
    });

    it('The System Weight: Large System Instructions force User History eviction', () => {
        // Scenario: A huge system instruction eats up the budget.
        // Normally, we might fit 5 messages. But with a huge system prompt, we might only fit 3.

        const msgText = generateTokenLoad(10);
        const history: Content[] = [
            createMsg('user', `MSG_0_${msgText}`),
            createMsg('model', `MSG_1_${msgText}`),
            createMsg('user', `MSG_2_${msgText}`),
            createMsg('model', `MSG_3_${msgText}`),
            createMsg('user', `MSG_4_${msgText}`)
        ];

        const historyTokens = ContextManager.estimateContextTokens(history);

        // Case A: No System Instruction -> Fits all
        const resultA = ContextManager.truncateContext(history, historyTokens + 10);
        expect(resultA).toHaveLength(5);

        // Case B: Huge System Instruction -> Squeezes history
        // System instruction size = size of 2 messages.
        // Budget remains same as Case A (historyTokens + 10).
        // Effective budget for history = (historyTokens + 10) - (2 messages worth).
        // Result should drop roughly 2 messages.

        const systemInstruction = generateTokenLoad(ContextManager.estimateContextTokens(history.slice(0, 2)));
        const resultB = ContextManager.truncateContext(history, historyTokens + 10, systemInstruction);

        expect(resultB.length).toBeLessThan(5);
        // It should prioritize keeping recent/anchor, so it likely drops index 1 or 2 first.
        expect(resultB.length).toBeGreaterThanOrEqual(3); // Anchor + 2 Recents
    });

    it('The Elephant: A single message larger than the limit does not crash', () => {
        // Scenario: The most recent message is 200 tokens, but limit is 100.
        // The "ContextManager" logs a warning but should return the message (best effort)
        // or handle it gracefully rather than crashing or returning empty array (if it's the only one).

        const hugeText = generateTokenLoad(200);
        const history: Content[] = [
            createMsg('user', hugeText)
        ];

        const maxTokens = 100;

        // Spy on console.warn to verify we're aware of the overflow
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = ContextManager.truncateContext(history, maxTokens);

        expect(result).toHaveLength(1);
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('The Impossible Squeeze: Correctly reduces to just last 2 messages if Anchor cannot fit', () => {
         // Scenario: Even Anchor + Last 2 is too big.
         // Strategy: It should sacrifice Anchor to save the immediate context (Recent 2).

         const msgText = generateTokenLoad(10);
         const history: Content[] = [
             createMsg('user', `ANCHOR_${msgText}`),
             createMsg('model', `MIDDLE_${msgText}`),
             createMsg('user', `RECENT_1_${msgText}`), // Keep
             createMsg('model', `RECENT_2_${msgText}`)  // Keep
         ];

         // Budget only fits 2 messages.
         const tokensForTwo = ContextManager.estimateContextTokens(history.slice(2));
         const maxTokens = tokensForTwo + 1;

         const result = ContextManager.truncateContext(history, maxTokens);

         expect(result).toHaveLength(2);
         expect(result[0]).toEqual(history[2]);
         expect(result[1]).toEqual(history[3]);
         // Anchor is gone
         expect(result).not.toContain(history[0]);
    });

});
