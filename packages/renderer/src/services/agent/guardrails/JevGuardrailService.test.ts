import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { systemOne } = vi.hoisted(() => ({
    systemOne: vi.fn(),
}));

vi.mock('@typesafe-ai/sdk', () => ({
    TypeSafeClient: class {
        constructor() {
            return { systemOne };
        }
    },
    noul: (instructions: string) => ({ type: 'noul', instructions }),
}));

import { JevGuardrailService } from './JevGuardrailService';

describe('JevGuardrailService', () => {
    let service: JevGuardrailService;

    const createClient = (answers: Record<string, number>) => ({
        systemOne: vi.fn().mockImplementation(() => Promise.resolve({ answers })),
    });

    beforeEach(() => {
        vi.stubEnv('VITE_TYPESAFE_API_KEY', 'test-typesafe-key');
        service = new JevGuardrailService();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('evaluates an actionable response without modification', async () => {
        const input = {
            text: 'I have analyzed your revenue. You have 3 pending payments totaling $1,250. Would you like me to process them now?',
            tool_calls: [{ name: 'get_revenue_analytics' }],
        };

        systemOne.mockResolvedValue({
            answers: {
                claims_disconnected_without_evidence: 0,
                claims_scheduled_without_tool: 0,
                confident_action_no_evidence: 0,
                is_actionable_response: 0.95,
            },
        });
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

        systemOne.mockResolvedValue({
            answers: {
                claims_disconnected_without_evidence: 0,
                claims_scheduled_without_tool: 0,
                confident_action_no_evidence: 0,
                is_actionable_response: 0.1,
            },
        });
        vi.useFakeTimers();
        service = new JevGuardrailService(createClient({ is_actionable_response: 0.1 }) as never);

        const result = await service.screen(input);
        vi.useRealTimers();

        expect(result.wasModified).toBe(true);
        expect(result.flags).toContain('unactionable_response');
        expect(result.text).toContain("Try asking me to schedule a post");
    });

    it('passes through the original response when Jev evaluation is unavailable', async () => {
        const input = { text: 'Here is your daily overview.' };
        systemOne.mockRejectedValue(new Error('Jev unavailable'));

        const result = await service.screen(input);

        expect(result).toEqual({
            text: input.text,
            wasModified: false,
            flags: [],
            confidence: {},
        });
    });
});
