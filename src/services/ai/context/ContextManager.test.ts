import { describe, it, expect } from 'vitest';
import { ContextManager } from './ContextManager';
import { Content } from '@/shared/types/ai.dto';

describe('ContextManager', () => {
    it('should estimate tokens correctly', () => {
        const text = 'Hello world'; // 11 chars. (11/4)*1.2 = 2.75 -> 3 tokens
        const tokens = ContextManager.estimateTokens(text);
        expect(tokens).toBe(4); // verify math: ceil(11/4 * 1.2) = ceil(2.75 * 1.2) wait. logic is ceil((len/4)*1.2). 11/4=2.75. 2.75*1.2 = 3.3 -> 4. Correct.
    });

    it('should estimate context tokens', () => {
        const context: Content[] = [
            { role: 'user', parts: [{ text: 'Hello' }] }, // 5 chars -> ceil(1.25*1.2)=ceil(1.5)=2
            { role: 'model', parts: [{ text: 'Hi' }] } // 2 chars -> ceil(0.5*1.2)=ceil(0.6)=1
        ];

        const total = ContextManager.estimateContextTokens(context);
        expect(total).toBeGreaterThan(0);
    });

    it('should not truncate if within limits', () => {
        const history: Content[] = [
            { role: 'user', parts: [{ text: 'Short message' }] }
        ];

        const result = ContextManager.truncateContext(history, 1000);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(history[0]);
    });

    it('should truncate old messages when over limit', () => {
        const history: Content[] = [
            { role: 'user', parts: [{ text: 'Old message 1' }] },
            { role: 'model', parts: [{ text: 'Old response 1' }] },
            { role: 'user', parts: [{ text: 'New message' }] },
            { role: 'model', parts: [{ text: 'New response' }] }
        ];

        // Ensure limit is small enough to force dropping first items but keep last 2
        // e.g. enough for just the last 2 messages
        const lastTwoTokens = ContextManager.estimateContextTokens(history.slice(2));
        const limit = lastTwoTokens + 5;

        const result = ContextManager.truncateContext(history, limit);

        expect(result.length).toBeLessThan(4);
        expect(result).toContain(history[2]); // verify we kept new stuff
        expect(result).toContain(history[3]);
        expect(result).not.toContain(history[0]); // verify we dropped old stuff
    });
});
