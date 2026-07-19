import { describe, it, expect } from 'vitest';
import { getAgentPrompt, VALID_AGENT_IDS } from './agentPrompts';

describe('getAgentPrompt — judgment layer execution contract', () => {
    it.each(VALID_AGENT_IDS)('carries the EXECUTION CONTRACT for agent "%s"', (agentId) => {
        const { prompt } = getAgentPrompt(agentId);
        expect(prompt).toContain('## EXECUTION CONTRACT');
    });

    it('falls back to generalist for an unknown agent id and still carries the contract', () => {
        const { resolvedAgentId, prompt } = getAgentPrompt('not-a-real-agent');
        expect(resolvedAgentId).toBe('generalist');
        expect(prompt).toContain('## EXECUTION CONTRACT');
    });
});
