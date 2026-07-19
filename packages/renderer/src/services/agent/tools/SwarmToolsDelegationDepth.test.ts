import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importWithRetry } from '@/utils/dynamicImport';
import { DelegationLoopDetector } from '../LoopDetector';

/**
 * Judgment layer: consult_specialist must share the same delegation-depth /
 * repeat-target budget as delegate_task (previously only delegate_task was
 * covered, leaving the A2A consult path an uncapped swarm-delegation vector).
 */

const mockInvoke = vi.fn();

vi.mock('../a2a/A2AClient', () => ({
    a2aClient: {
        stream: vi.fn(),
        invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    A2ATransportUnavailableError: class extends Error {},
}));

vi.mock('../governance/AgentIdentity', () => ({
    agentIdentityService: { recordDelegation: vi.fn() },
}));

function makeContext(overrides: Record<string, unknown> = {}) {
    return {
        directive: { id: 'd1', userId: 'u1' },
        agentIdentity: { agentId: 'generalist' },
        runAgent: vi.fn(),
        traceId: 't1',
        swarmId: 'swarm-depth-test',
        ...overrides,
    };
}

describe('consult_specialist — delegation depth cap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        DelegationLoopDetector.cleanup('swarm-depth-test');
        mockInvoke.mockResolvedValue({ text: 'ok', agentId: 'marketing' });
    });

    afterEach(() => {
        DelegationLoopDetector.cleanup('swarm-depth-test');
    });

    it('rejects a consult once the delegation chain reaches MAX_DELEGATION_DEPTH', async () => {
        const { consult_specialist } = await importWithRetry(() => import('./SwarmTools'));
        const ctx = makeContext();

        // Pre-seed the chain to MAX_DELEGATION_DEPTH (4) with distinct agents.
        DelegationLoopDetector.recordDelegation('swarm-depth-test', 'social');
        DelegationLoopDetector.recordDelegation('swarm-depth-test', 'finance');
        DelegationLoopDetector.recordDelegation('swarm-depth-test', 'brand');
        DelegationLoopDetector.recordDelegation('swarm-depth-test', 'legal');

        const result = await consult_specialist({ targetAgentId: 'distribution', task: 'go' }, ctx as never);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot consult');
        expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('rejects consulting the same specialist twice within one swarm/trace', async () => {
        const { consult_specialist } = await importWithRetry(() => import('./SwarmTools'));
        const ctx = makeContext();

        const first = await consult_specialist({ targetAgentId: 'marketing', task: 'go' }, ctx as never);
        expect(first.success).toBe(true);

        const second = await consult_specialist({ targetAgentId: 'marketing', task: 'go again' }, ctx as never);
        expect(second.success).toBe(false);
        expect(second.error).toContain('Cannot consult');
    });

    it('allows a fresh consult when under the depth cap and no repeat target', async () => {
        const { consult_specialist } = await importWithRetry(() => import('./SwarmTools'));
        const ctx = makeContext();

        const result = await consult_specialist({ targetAgentId: 'marketing', task: 'go' }, ctx as never);

        expect(result.success).toBe(true);
        expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
});
