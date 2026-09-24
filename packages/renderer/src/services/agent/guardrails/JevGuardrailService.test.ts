import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JevGuardrailService } from './JevGuardrailService';

describe('JevGuardrailService', () => {
    let service: JevGuardrailService;

    beforeEach(() => {
        service = new JevGuardrailService();
        vi.clearAllMocks();
    });

    it('evaluates an actionable response without modification', async () => {
        const input = {
            text: 'I have analyzed your revenue. You have 3 pending payments totaling $1,250. Would you like me to process them now?',
            tool_calls: [{ name: 'get_revenue_analytics' }],
        };

        const result = await service.screen(input);

        expect(result.text).toBe(input.text);
        expect(result.wasModified).toBe(false);
    });

    it('intercepts unactionable text with helpful fallback when evaluated', async () => {
        const input = {
            text: 'Here is your daily overview.',
        };

        const result = await service.screen(input);

        // Jev evaluates 'Here is your daily overview.' with low actionable score (<0.3)
        // and modifies the response to provide actionable direction
        expect(result.wasModified).toBe(true);
        expect(result.flags).toContain('unactionable_response');
        expect(result.text).toContain("Try asking me to schedule a post");
    });
});
