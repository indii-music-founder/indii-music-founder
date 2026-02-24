import { describe, it, expect } from 'vitest';
import { ContextManager } from '../src/services/ai/context/ContextManager';

describe('ContextManager Loop Repro', () => {
    it('should NOT infinite loop even with 0 token messages', () => {
        const history: any[] = [
            { role: 'user', parts: [{ text: '' }] },
            { role: 'model', parts: [{ text: '' }] },
            { role: 'user', parts: [{ text: '' }] },
            { role: 'model', parts: [{ text: '' }] },
            { role: 'user', parts: [{ text: '' }] }
        ];

        // If estimateTokens('') returns 0, and we have system tokens > maxTokens
        const result = ContextManager.truncateContext(history, 1, 'Very long system instruction that exceeds maxTokens');

        expect(result.length).toBe(2); // Should stop at MIN_RECENT_MESSAGES
    });

    it('should NOT infinite loop with large number of messages', () => {
        const history = Array(1000).fill({ role: 'user', parts: [{ text: 'a' }] });
        const result = ContextManager.truncateContext(history, 1);
        expect(result.length).toBe(2);
    });
});
