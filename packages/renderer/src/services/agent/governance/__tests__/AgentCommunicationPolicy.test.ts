import { describe, expect, it } from 'vitest';
import { validateAgentCommunication } from '../AgentCommunicationPolicy';

describe('AgentCommunicationPolicy', () => {
    it('allows a manager to assign work only to its own employee', () => {
        expect(validateAgentCommunication({ sourceAgentId: 'finance', targetAgentId: 'finance.tax', kind: 'task', mode: 'department' }).allowed).toBe(true);
        const blocked = validateAgentCommunication({ sourceAgentId: 'finance.tax', targetAgentId: 'finance', kind: 'task', mode: 'department' });
        expect(blocked).toMatchObject({ allowed: false, code: 'MANAGER_ROUTE_REQUIRED' });
    });

    it('allows seated Boardroom managers to share notes but not work assignments', () => {
        const base = { sourceAgentId: 'brand', targetAgentId: 'marketing', mode: 'boardroom' as const, seatedAgents: ['brand', 'marketing'] };
        expect(validateAgentCommunication({ ...base, kind: 'note' }).allowed).toBe(true);
        expect(validateAgentCommunication({ ...base, kind: 'task' })).toMatchObject({ allowed: false, code: 'BOARDROOM_NOTES_ONLY' });
    });

    it('does not let a Boardroom manager reach an unseated manager or employee', () => {
        expect(validateAgentCommunication({ sourceAgentId: 'brand', targetAgentId: 'marketing', kind: 'note', mode: 'boardroom', seatedAgents: ['brand'] })).toMatchObject({ allowed: false, code: 'BOARDROOM_SEATING_VIOLATION' });
        expect(validateAgentCommunication({ sourceAgentId: 'finance', targetAgentId: 'finance.tax', kind: 'note', mode: 'boardroom', seatedAgents: ['finance', 'finance.tax'] })).toMatchObject({ allowed: false, code: 'BOARDROOM_TIER_VIOLATION' });
    });
});
