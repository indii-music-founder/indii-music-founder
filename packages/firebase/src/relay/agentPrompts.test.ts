import { describe, it, expect } from 'vitest';
import { getAgentPrompt, VALID_AGENT_IDS } from './agentPrompts';

describe('getAgentPrompt — judgment layer execution contract', () => {
    it.each(VALID_AGENT_IDS)('carries the EXECUTION CONTRACT and capability grounding for agent "%s"', (agentId) => {
        const { prompt } = getAgentPrompt(agentId);
        expect(prompt).toContain('## EXECUTION CONTRACT');
        expect(prompt).toContain('ZERO TOLERANCE FOR FABRICATING ENGINEERING ROADMAPS');
    });

    it('falls back to generalist for an unknown agent id and still carries the contract', () => {
        const { resolvedAgentId, prompt } = getAgentPrompt('not-a-real-agent');
        expect(resolvedAgentId).toBe('generalist');
        expect(prompt).toContain('## EXECUTION CONTRACT');
        expect(prompt).toContain('ZERO TOLERANCE FOR FABRICATING ENGINEERING ROADMAPS');
    });

    it('generalist conductor prompt affirms all 23 departments and zero roadmap fabrication', () => {
        const { prompt } = getAgentPrompt('generalist');
        expect(prompt).toContain('across all 23 departments');
        expect(prompt).toContain('Capability & Status Grounding (Zero Hallucination)');
    });
});
