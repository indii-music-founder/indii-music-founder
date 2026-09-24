import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JevGuardrailService } from './JevGuardrailService';

describe('JevGuardrailService', () => {
    let service: JevGuardrailService;

    const createClient = (answers: Record<string, number>) => ({
        systemOne: vi.fn().mockImplementation(() => Promise.resolve({ answers })),
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('evaluates an actionable response without modification', async () => {
        const input = {
            text: 'I have analyzed your revenue. You have 3 pending payments totaling $1,250. Would you like me to process them now?',
            tool_calls: [{ name: 'get_revenue_analytics' }],
        };

        vi.useFakeTimers();
        service = new JevGuardrailService(createClient({ is_actionable_response: 0.95 }) as never);

        const result = await service.screen(input);
        vi.useRealTimers();

        expect(result.text).toBe(input.text);
        expect(result.wasModified).toBe(false);
    });

    it('intercepts unactionable text with helpful fallback when evaluated', async () => {
        const input = {
            text: 'Here is your daily overview.',
        };

        vi.useFakeTimers();
        service = new JevGuardrailService(createClient({ is_actionable_response: 0.1 }) as never);

        const result = await service.screen(input);
        vi.useRealTimers();

        expect(result.wasModified).toBe(true);
        expect(result.flags).toContain('unactionable_response');
        expect(result.text).toContain("Try asking me to schedule a post");
    });
});
