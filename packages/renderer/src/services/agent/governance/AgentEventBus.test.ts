import { describe, expect, it } from 'vitest';
import { events, type AgentActionEvent } from '@/core/events';
import { AgentEventBus } from './AgentEventBus';

describe('AgentEventBus', () => {
    it('preserves structured tool fields alongside the legacy action text', () => {
        const received: AgentActionEvent[] = [];
        const off = events.on<AgentActionEvent>('AGENT_ACTION', event => received.push(event));
        try {
            AgentEventBus.emitToolEvent('TOOL_EXECUTION_FAILED', {
                agentId: 'agent-1', toolName: 'lookup', timestamp: 123, durationMs: 0,
                targetContext: 'project-1', errorMessage: 'provider failed',
            });
            expect(received).toEqual([expect.objectContaining({
                agentId: 'agent-1', action: 'TOOL_EXECUTION_FAILED', toolName: 'lookup',
                timestamp: 123, durationMs: 0, targetContext: 'project-1',
                errorMessage: 'provider failed', details: 'Tool: lookup (0ms)',
            })]);
        } finally {
            off();
        }
    });

    it('keeps graph and session identities as fields', () => {
        const received: AgentActionEvent[] = [];
        const off = events.on<AgentActionEvent>('AGENT_ACTION', event => received.push(event));
        try {
            AgentEventBus.emitSessionEvent('AGENT_SESSION_COMPLETED', { agentId: 'agent-1', sessionId: 'session-1', durationMs: 0 });
            AgentEventBus.emitNodeEvent('GRAPH_NODE_COMPLETED', 'graph-1', 'node-1', 'execution-1');
            expect(received[0]).toMatchObject({ sessionId: 'session-1', durationMs: 0 });
            expect(received[1]).toMatchObject({ graphId: 'graph-1', nodeId: 'node-1', executionId: 'execution-1' });
        } finally {
            off();
        }
    });
});
