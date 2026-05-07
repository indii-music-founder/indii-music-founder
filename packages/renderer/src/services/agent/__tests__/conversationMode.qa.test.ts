/**
 * Conversation Mode QA — Phase 8.4 manual scenarios converted to deterministic
 * automated tests. Each scenario exercises the actual BaseAgent enforcement code
 * paths (delegate_task / consult_experts) against a real BaseAgent instance with
 * a hand-rolled AgentContext.
 *
 * Coverage parity with Phase 8.4 manual QA:
 *
 *   1. Direct mode — Finance head attempts cross-agent work → DIRECT_MODE_NO_DELEGATION
 *   2. Department mode — Finance head delegates to its own worker → succeeds.
 *      Finance head attempts cross-dept (legal) → DEPARTMENT_SCOPE_VIOLATION
 *   3. Boardroom mode — head→head with seating → succeeds. head→worker (unseated tier)
 *      → BOARDROOM_TIER_VIOLATION. head→unseated head → BOARDROOM_SEATING_VIOLATION
 */

import { describe, it, expect, vi } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import type { AgentConfig, AgentContext, ValidAgentId } from '../types';
import { DEPARTMENTS } from '../departments';

function makeAgent(id: ValidAgentId): BaseAgent {
    const config: AgentConfig = {
        id,
        name: `Test ${id}`,
        description: `Test agent ${id}`,
        color: '#000',
        category: 'department',
        systemPrompt: 'test',
        tools: [],
    };
    return new BaseAgent(config);
}

let traceCounter = 0;
function makeCtx(overrides: Partial<AgentContext> & Record<string, unknown> = {}): AgentContext {
    return {
        userId: 'test-user',
        // Unique trace per call — DelegationLoopDetector keys off traceId and would
        // otherwise accumulate state across tests and trigger false positives.
        traceId: `test-trace-${++traceCounter}-${Math.random().toString(36).slice(2, 8)}`,
        runAgent: vi.fn().mockResolvedValue({ text: 'mock response from delegate' }),
        ...overrides,
    } as AgentContext;
}

// Access protected functions map for direct tool invocation (test-only).
function getTool(agent: BaseAgent, name: 'delegate_task' | 'consult_experts') {
     
    return (agent as any).functions[name];
}

describe('Conversation Mode enforcement — QA scenarios', () => {

    describe('1. Direct mode (DIRECT_MODE_NO_DELEGATION)', () => {
        it('blocks delegate_task when conversationMode is direct', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({ conversationMode: 'direct' });

            const result = await getTool(finance, 'delegate_task')(
                { targetAgentId: 'legal', task: 'review the contract' },
                ctx,
            );

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('DIRECT_MODE_NO_DELEGATION');
            expect(ctx.runAgent).not.toHaveBeenCalled();
        });

        it('blocks consult_experts when conversationMode is direct', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({ conversationMode: 'direct' });

            const result = await getTool(finance, 'consult_experts')(
                { consultations: [{ targetAgentId: 'legal', task: 'review' }] },
                ctx,
            );

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('DIRECT_MODE_NO_DELEGATION');
            expect(ctx.runAgent).not.toHaveBeenCalled();
        });
    });

    describe('2. Department mode (DEPARTMENT_SCOPE_VIOLATION)', () => {
        it('allows finance head to delegate to its own worker', async () => {
            // Seed Finance worker for the duration of this test
            const dept = DEPARTMENTS.finance!;
            dept.workerIds.push('finance.tax');
            try {
                const finance = makeAgent('finance');
                const ctx = makeCtx({ conversationMode: 'department' });

                const result = await getTool(finance, 'delegate_task')(
                    { targetAgentId: 'finance.tax', task: 'compute Q3 estimates' },
                    ctx,
                );

                expect(result.success).toBe(true);
                expect(ctx.runAgent).toHaveBeenCalledWith(
                    'finance.tax',
                    'compute Q3 estimates',
                    expect.any(Object),
                    expect.any(String),
                    undefined,
                );
            } finally {
                dept.workerIds.length = 0;
            }
        });

        it('blocks finance head from delegating cross-department to legal', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({ conversationMode: 'department' });

            const result = await getTool(finance, 'delegate_task')(
                { targetAgentId: 'legal', task: 'review' },
                ctx,
            );

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('DEPARTMENT_SCOPE_VIOLATION');
            expect(ctx.runAgent).not.toHaveBeenCalled();
        });

        it('blocks consult_experts cross-department in Department mode', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({ conversationMode: 'department' });

            const result = await getTool(finance, 'consult_experts')(
                {
                    consultations: [
                        { targetAgentId: 'legal', task: 'review the contract' },
                        { targetAgentId: 'marketing', task: 'campaign idea' },
                    ],
                },
                ctx,
            );

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('DEPARTMENT_SCOPE_VIOLATION');
        });
    });

    describe('3. Boardroom mode (BOARDROOM_TIER_VIOLATION + SEATING)', () => {
        it('allows head→head delegation when both heads are seated', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({
                conversationMode: 'boardroom',
                isBoardroomMode: true,
                seatedAgents: ['finance', 'legal'],
            } as Partial<AgentContext> & Record<string, unknown>);

            const result = await getTool(finance, 'delegate_task')(
                { targetAgentId: 'legal', task: 'review' },
                ctx,
            );

            expect(result.success).toBe(true);
            expect(ctx.runAgent).toHaveBeenCalled();
        });

        it('blocks head→worker delegation in Boardroom (workers cannot be seated)', async () => {
            const dept = DEPARTMENTS.finance!;
            dept.workerIds.push('finance.tax');
            try {
                const finance = makeAgent('finance');
                const ctx = makeCtx({
                    conversationMode: 'boardroom',
                    isBoardroomMode: true,
                    // Even if a worker were somehow named in seatedAgents, tier check
                    // takes precedence — Boardroom is a heads-only room.
                    seatedAgents: ['finance', 'finance.tax'],
                } as Partial<AgentContext> & Record<string, unknown>);

                const result = await getTool(finance, 'delegate_task')(
                    { targetAgentId: 'finance.tax', task: 'compute taxes' },
                    ctx,
                );

                expect(result.success).toBe(false);
                expect(result.metadata?.errorCode).toBe('BOARDROOM_TIER_VIOLATION');
                expect(ctx.runAgent).not.toHaveBeenCalled();
            } finally {
                dept.workerIds.length = 0;
            }
        });

        it('blocks head→head delegation when target is unseated', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({
                conversationMode: 'boardroom',
                isBoardroomMode: true,
                seatedAgents: ['finance'], // legal NOT seated
            } as Partial<AgentContext> & Record<string, unknown>);

            const result = await getTool(finance, 'delegate_task')(
                { targetAgentId: 'legal', task: 'review' },
                ctx,
            );

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('BOARDROOM_SEATING_VIOLATION');
            expect(ctx.runAgent).not.toHaveBeenCalled();
        });

        it('consult_experts surfaces tier violation when any target is a worker', async () => {
            const dept = DEPARTMENTS.finance!;
            dept.workerIds.push('finance.tax');
            try {
                const finance = makeAgent('finance');
                const ctx = makeCtx({
                    conversationMode: 'boardroom',
                    isBoardroomMode: true,
                    seatedAgents: ['finance', 'legal', 'finance.tax'],
                } as Partial<AgentContext> & Record<string, unknown>);

                const result = await getTool(finance, 'consult_experts')(
                    {
                        consultations: [
                            { targetAgentId: 'legal', task: 'review' },
                            { targetAgentId: 'finance.tax', task: 'tax check' },
                        ],
                    },
                    ctx,
                );

                expect(result.success).toBe(false);
                expect(result.metadata?.errorCode).toBe('BOARDROOM_TIER_VIOLATION');
            } finally {
                dept.workerIds.length = 0;
            }
        });
    });

    describe('Sanity — modeless context (legacy path) still works', () => {
        it('delegates without scope checks when conversationMode is undefined', async () => {
            const finance = makeAgent('finance');
            const ctx = makeCtx({}); // no conversationMode set

            const result = await getTool(finance, 'delegate_task')(
                { targetAgentId: 'legal', task: 'review' },
                ctx,
            );

            expect(result.success).toBe(true);
            expect(ctx.runAgent).toHaveBeenCalled();
        });
    });
});
