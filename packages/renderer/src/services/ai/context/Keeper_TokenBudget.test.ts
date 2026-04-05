
import { describe, it, expect } from 'vitest';
import { ContextManager } from './ContextManager';
import { Content } from '@/shared/types/ai.dto';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function makeContent(role: 'user' | 'model', text: string): Content {
    return {
        role,
        parts: [{ text }]
    };
}

/**
 * Generates a string of approximate token count.
 * Logic: tokens = ceil(chars / 4 * 1.2)
 * Inverse: chars = (tokens / 1.2) * 4 = tokens * 3.33
 */
function generateTextForTokens(tokens: number): string {
    // Roughly 3.4 chars per token to be safe and hit the target
    const charCount = Math.ceil(tokens * 3.4);
    return 'a'.repeat(charCount);
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('📚 Keeper: Token Budget & Context Integrity', () => {

    it('should correctly estimate tokens', () => {
        // "Hello" is 5 chars. 5/4 * 1.2 = 1.25 * 1.2 = 1.5 -> ceil -> 2 tokens
        const text = "Hello";
        const tokens = ContextManager.estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(10);
    });

    it('should NOT truncate history if within budget', () => {
        const history: Content[] = [
            makeContent('user', 'Hello'),
            makeContent('model', 'Hi there')
        ];
        const maxTokens = 1000;

        const result = ContextManager.truncateContext(history, maxTokens);

        expect(result).toHaveLength(2);
        expect(result).toEqual(history);
    });

    it('should truncate "Middle" messages when over budget, preserving Anchor and Recency', () => {
        // Setup:
        // 1. Anchor (First): 100 tokens
        // 2. Middle 1: 500 tokens
        // 3. Middle 2: 500 tokens
        // 4. Recent 1 (User): 50 tokens
        // 5. Recent 2 (Model): 50 tokens
        // Total = 1200 tokens

        const anchor = makeContent('user', generateTextForTokens(100)); // ~100
        const middle1 = makeContent('model', generateTextForTokens(500)); // ~500
        const middle2 = makeContent('user', generateTextForTokens(500)); // ~500
        const recent1 = makeContent('model', generateTextForTokens(50)); // ~50
        const recent2 = makeContent('user', generateTextForTokens(50)); // ~50

        const history = [anchor, middle1, middle2, recent1, recent2];
        const maxTokens = 800; // Should force dropping middle1 and middle2

        // Act
        const result = ContextManager.truncateContext(history, maxTokens);

        // Assert
        // We expect Anchor + Recent1 + Recent2 to survive = ~200 tokens
        // Middle ones should go.

        // Logic check:
        // Initial: 1200 > 800
        // Loop 1: Drop index 1 (Middle1). New total: 700.
        // 700 <= 800? Yes. Stop.
        // Wait, removing Middle1 (500) brings it to 700. So Middle2 might survive?

        // Let's adjust maxTokens to force BOTH middles out.
        // Target: 250 tokens allowed.
        // Initial: 1200
        // Drop Middle1 -> 700
        // Drop Middle2 -> 200 (Passes)

        const strictMaxTokens = 250;
        const strictResult = ContextManager.truncateContext(history, strictMaxTokens);

        expect(strictResult).toHaveLength(3);
        expect(strictResult[0]).toEqual(anchor); // Anchor preserved
        expect(strictResult[1]).toEqual(recent1); // Recent 1 preserved
        expect(strictResult[2]).toEqual(recent2); // Recent 2 preserved
    });

    it('should account for System Instruction tokens', () => {
        // Setup: History is small (100 tokens)
        // System Instruction is HUGE (950 tokens)
        // Max Tokens = 1000

        const history = [
            makeContent('user', generateTextForTokens(50)),
            makeContent('model', generateTextForTokens(50))
        ];

        // If System Instruction is ignored, 100 < 1000, no truncation.
        // If System Instruction is counted (950), total = 1050 > 1000.
        // It should try to truncate history.

        const hugeSystemPrompt = generateTextForTokens(950);

        // Act
        const result = ContextManager.truncateContext(history, 1000, hugeSystemPrompt);

        // Assert
        // It should have tried to remove something.
        // With only 2 messages (MIN_RECENT_MESSAGES = 2), logic says:
        // "While over budget and truncated.length > MIN_RECENT_MESSAGES"
        // It will STOP because it can't remove the recent messages.

        expect(result).toHaveLength(2); // Can't go below min recent

        // Let's add a 3rd message to verify it actually drops one.
        const history3 = [
            makeContent('user', 'Old message'),
            makeContent('user', generateTextForTokens(50)),
            makeContent('model', generateTextForTokens(50))
        ];
        // Total ~1100 > 1000

        const result2 = ContextManager.truncateContext(history3, 1000, hugeSystemPrompt);

        // Should drop 'Old message' (index 0 because length 3 is not > MIN_RECENT + 1 for middle drop?
        // Logic: if KEEP_FIRST && length > 3 ... here length is 3. 3 > 3 is false.
        // So removeIndex = 0.

        expect(result2).toHaveLength(2);
        expect(result2[0]).toEqual(history3[1]); // Old message gone
    });

    it('should recover gracefully if history is absurdly large', () => {
        // 50 messages, each 100 tokens. Total 5000.
        // Max 500.
        const history = Array.from({ length: 50 }, (_, i) =>
            makeContent(i % 2 === 0 ? 'user' : 'model', generateTextForTokens(100))
        );

        const maxTokens = 500;

        const startTime = Date.now();
        const result = ContextManager.truncateContext(history, maxTokens);
        const duration = Date.now() - startTime;

        // Performance check
        expect(duration).toBeLessThan(50); // Should be instant

        // Integrity check
        // Should preserve Anchor (idx 0) and Last 2 (idx 48, 49)
        // Plus maybe some more if space allows.
        // Anchor (100) + Last 2 (200) = 300.
        // Space 500. So we have 200 left.
        // It drops from index 1.

        expect(result.length).toBeGreaterThanOrEqual(3);
        expect(result[0]).toEqual(history[0]); // Anchor
        expect(result[result.length - 1]).toEqual(history[49]); // Last
        expect(result[result.length - 2]).toEqual(history[48]); // Second to last

        const totalEstimated = ContextManager.estimateContextTokens(result);
        expect(totalEstimated).toBeLessThanOrEqual(maxTokens);
    });

});
