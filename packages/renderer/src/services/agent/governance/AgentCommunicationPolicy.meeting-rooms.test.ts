import { describe, expect, it } from 'vitest';
import { validateAgentCommunication } from '@/services/agent/governance/AgentCommunicationPolicy';

describe('AgentCommunicationPolicy — Meeting Room mode', () => {
    it('allows seated department heads and workers to share notes in a Meeting Room', () => {
        const result = validateAgentCommunication({
            sourceAgentId: 'creative',
            targetAgentId: 'finance.tax',
            kind: 'note',
            mode: 'meeting-room',
            seatedAgents: ['creative', 'finance.tax'],
        });
        expect(result.allowed).toBe(true);
    });

    it('allows a seated department head to assign a task to their own seated worker', () => {
        const result = validateAgentCommunication({
            sourceAgentId: 'finance',
            targetAgentId: 'finance.tax',
            kind: 'task',
            mode: 'meeting-room',
            seatedAgents: ['finance', 'finance.tax'],
        });
        expect(result.allowed).toBe(true);
    });

    it('blocks cross-department task delegation in a Meeting Room', () => {
        const result = validateAgentCommunication({
            sourceAgentId: 'creative',
            targetAgentId: 'finance.tax',
            kind: 'task',
            mode: 'meeting-room',
            seatedAgents: ['creative', 'finance.tax'],
        });
        expect(result.allowed).toBe(false);
        expect(result.code).toBe('MEETING_ROOM_NOTES_ONLY');
    });

    it('rejects communication targeting an agent not seated in the Meeting Room', () => {
        const result = validateAgentCommunication({
            sourceAgentId: 'creative',
            targetAgentId: 'legal.contracts',
            kind: 'note',
            mode: 'meeting-room',
            seatedAgents: ['creative', 'marketing'],
        });
        expect(result.allowed).toBe(false);
        expect(result.code).toBe('MEETING_ROOM_SEATING_VIOLATION');
    });

    it('preserves Boardroom HQ tier restriction against workers', () => {
        const result = validateAgentCommunication({
            sourceAgentId: 'creative',
            targetAgentId: 'finance.tax',
            kind: 'note',
            mode: 'boardroom',
            seatedAgents: ['creative', 'finance.tax'],
        });
        expect(result.allowed).toBe(false);
        expect(result.code).toBe('BOARDROOM_TIER_VIOLATION');
    });
});
